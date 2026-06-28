package com.grafide.controller;

import com.grafide.model.User;
import com.grafide.repository.UserRepository;
import com.grafide.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository   userRepo;
    private final JwtUtil          jwtUtil;
    private final PasswordEncoder  passwordEncoder;

    @Value("${grafide.editor.code}")
    private String editorCode;

    @Value("${grafide.base-url}")
    private String baseUrl;

    @Value("${grafide.mail.enabled:false}")
    private boolean mailEnabled;

    // ── Simple in-memory login rate limiter ─────────────────────
    // Keyed by IP address; stores failed attempt timestamps
    private final Map<String, List<Instant>> loginAttempts = new ConcurrentHashMap<>();
    private static final int    MAX_ATTEMPTS = 5;
    private static final long   WINDOW_MIN   = 15;

    private boolean isRateLimited(String ip) {
        loginAttempts.putIfAbsent(ip, new ArrayList<>());
        List<Instant> attempts = loginAttempts.get(ip);
        Instant windowStart = Instant.now().minus(WINDOW_MIN, ChronoUnit.MINUTES);
        attempts.removeIf(t -> t.isBefore(windowStart));
        return attempts.size() >= MAX_ATTEMPTS;
    }

    private void recordFailedAttempt(String ip) {
        loginAttempts.computeIfAbsent(ip, k -> new ArrayList<>()).add(Instant.now());
    }

    private void clearAttempts(String ip) {
        loginAttempts.remove(ip);
    }

    // ── Register ─────────────────────────────────────────────────
    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(
            @RequestBody Map<String, String> body) {

        String username    = body.getOrDefault("username", "").trim().toLowerCase();
        String password    = body.getOrDefault("password", "");
        String displayName = body.getOrDefault("displayName", "").trim();
        String email       = body.getOrDefault("email", "").trim().toLowerCase();
        String code        = body.get("editorCode") != null ? (String) body.get("editorCode") : "";

        if (username.isBlank() || password.isBlank() || displayName.isBlank() || email.isBlank()) {
            throw new IllegalArgumentException("All fields are required.");
        }
        if (username.contains("@") || username.contains(" ")) {
            throw new IllegalArgumentException("Username cannot contain @ or spaces. Use letters, numbers, and underscores only.");
        }
        if (username.length() < 3) {
            throw new IllegalArgumentException("Username must be at least 3 characters.");
        }
        if (password.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters.");
        }
        if (userRepo.existsByUsername(username)) {
            throw new IllegalArgumentException("That username is already taken. Please choose another.");
        }
        if (userRepo.existsByEmail(email)) {
            throw new IllegalArgumentException("An account with that email already exists.");
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(displayName);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(!code.isBlank() && editorCode.equals(code) ? "editor" : "creator");

        userRepo.save(user);
        return ResponseEntity.ok(Map.of("message", "Account created successfully."));
    }

    // ── Login ─────────────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> body,
            jakarta.servlet.http.HttpServletRequest request) {

        String ip       = request.getRemoteAddr();
        String username = body.getOrDefault("username", "").trim().toLowerCase();
        String password = body.getOrDefault("password", "");

        if (isRateLimited(ip)) {
            return ResponseEntity.status(429)
                    .body(Map.of("message", "Too many failed attempts. Please wait 15 minutes."));
        }

        Optional<User> found = userRepo.findByUsername(username);
        if (found.isEmpty() || !passwordEncoder.matches(password, found.get().getPassword())) {
            recordFailedAttempt(ip);
            throw new IllegalArgumentException("Invalid username or password.");
        }

        clearAttempts(ip);
        User user  = found.get();
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());

        Map<String, Object> resp = new HashMap<>();
        resp.put("token",       token);
        resp.put("username",    user.getUsername());
        resp.put("displayName", user.getDisplayName());
        resp.put("role",        user.getRole());
        return ResponseEntity.ok(resp);
    }

    // ── Forgot password ──────────────────────────────────────────
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @RequestBody Map<String, String> body) {

        String username = body.getOrDefault("username", "").trim().toLowerCase();
        Optional<User> found = userRepo.findByUsername(username);

        // Always return success to prevent user enumeration
        String message = "If that username exists, a reset link has been sent.";

        if (found.isPresent()) {
            User user  = found.get();
            String token = UUID.randomUUID().toString();
            user.setResetToken(token);
            user.setResetTokenExpiry(Instant.now().plus(1, ChronoUnit.HOURS));
            userRepo.save(user);

            String link = baseUrl + "/pages/auth.html?token=" + token;

            if (mailEnabled) {
                // Mail sending is wired in a separate MailService (optional)
                // For now log to console — attach MailService when SMTP is configured
                System.out.println("[Grafide] Password reset link for " + username + ": " + link);
            } else {
                System.out.println("[Grafide] Password reset link for " + username + ": " + link);
            }
        }

        return ResponseEntity.ok(Map.of("message", message));
    }

    // ── Reset password ───────────────────────────────────────────
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @RequestBody Map<String, String> body) {

        String token    = body.getOrDefault("token", "");
        String password = body.getOrDefault("password", "");

        if (token.isBlank() || password.isBlank()) {
            throw new IllegalArgumentException("Token and new password are required.");
        }
        if (password.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters.");
        }

        User user = userRepo.findByResetToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset link."));

        if (user.getResetTokenExpiry() == null || Instant.now().isAfter(user.getResetTokenExpiry())) {
            throw new IllegalArgumentException("Reset link has expired. Please request a new one.");
        }

        user.setPassword(passwordEncoder.encode(password));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepo.save(user);

        return ResponseEntity.ok(Map.of("message", "Password updated successfully."));
    }
}
