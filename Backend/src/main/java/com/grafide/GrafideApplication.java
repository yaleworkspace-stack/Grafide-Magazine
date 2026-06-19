package com.grafide;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import javax.crypto.SecretKey;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import java.util.stream.Collectors;

// ============================================================
// MAIN
// ============================================================
@SpringBootApplication
public class GrafideApplication {

    public static void main(String[] args) {
        SpringApplication.run(GrafideApplication.class, args);
    }

    // Active only under the "local" profile (native Windows dev).
    // In the "prod" profile (Docker / Render) the frontend is a separate
    // Static Site and Spring does not serve any static files at all.
    @Profile("local")
    @Bean
    public WebMvcConfigurer staticFrontendConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addResourceHandlers(ResourceHandlerRegistry registry) {
                registry.addResourceHandler("/**")
                        .addResourceLocations("file:../Frontend/");
            }
        };
    }
}
// ============================================================
// HEALTH CHECK — GET /api/health
// ============================================================
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
class HealthController {
    private final UserRepository userRepo;

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        try {
            long users = userRepo.count();
            return ResponseEntity.ok(Map.of("status", "ok", "users", users,
                "time", Instant.now().toString()));
        } catch (Exception e) {
            log.error("Health check — MongoDB unreachable: {}", e.getMessage());
            return ResponseEntity.status(503).body(Map.of(
                "status", "error",
                "message", "Database unreachable. Verify SPRING_DATA_MONGODB_URI on Render.",
                "detail", e.getMessage()));
        }
    }
}

// ============================================================
// GLOBAL EXCEPTION HANDLER
// ============================================================
@RestControllerAdvice
@Slf4j
class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage).collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(Map.of("message", msg));
    }

    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<?> handleDb(org.springframework.dao.DataAccessException ex) {
        log.error("Database error: {}", ex.getMessage());
        return ResponseEntity.status(503).body(Map.of(
            "message", "Database error — check SPRING_DATA_MONGODB_URI on Render.",
            "detail", ex.getMessage()));
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<?> handleNoResource(org.springframework.web.servlet.resource.NoResourceFoundException ex) {
        // Let Spring handle static resource 404s normally rather than wrapping in JSON
        return ResponseEntity.notFound().build();
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleAll(Exception ex, HttpServletRequest req) {
        log.error("Unhandled error on {}: {}", req.getRequestURI(), ex.getMessage(), ex);
        return ResponseEntity.status(500).body(Map.of(
            "message", "An unexpected error occurred.", "detail", ex.getMessage()));
    }
}

// ============================================================
// LOGIN RATE LIMITER
// ============================================================
@Component
class LoginRateLimiter {
    // CopyOnWriteArrayList is thread-safe for the read-heavy, occasional-write
    // access pattern of a rate-limit window. The outer ConcurrentHashMap prevents
    // races on key insertion. Both locks are still held by the synchronized methods
    // to make the check-then-act sequence atomic within a single JVM instance.
    private final ConcurrentHashMap<String, List<Long>> windows = new ConcurrentHashMap<>();
    private static final int  MAX_ATTEMPTS = 10;
    private static final long WINDOW_MS    = 15 * 60 * 1000L;

    public synchronized boolean isAllowed(String key) {
        long now = System.currentTimeMillis();
        List<Long> times = windows.computeIfAbsent(key, k -> new java.util.concurrent.CopyOnWriteArrayList<>());
        times.removeIf(t -> now - t > WINDOW_MS);
        if (times.size() >= MAX_ATTEMPTS) return false;
        times.add(now);
        return true;
    }

    public synchronized void reset(String key) {
        windows.remove(key);
    }
}

// ============================================================
// ARTICLE CONTROLLER
// ============================================================
@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
@Slf4j
class ArticleController {
    private final ArticleRepository articleRepo;

    @PostConstruct
    void migrate() {
        seed();
        List<Article> legacy = articleRepo.findAll().stream()
            .filter(a -> a.getPublished() == null).toList();
        if (!legacy.isEmpty()) {
            legacy.forEach(a -> a.setPublished(true));
            articleRepo.saveAll(legacy);
            log.info("Migrated {} legacy articles to published=true", legacy.size());
        }
    }

    // GET /api/articles?category=X&page=0&size=12
    @GetMapping
    public Map<String, Object> list(
        @RequestParam(required = false) String category,
        @RequestParam(defaultValue = "0")  int page,
        @RequestParam(defaultValue = "12") int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "date"));
        Page<Article> result = (category != null && !category.isBlank())
            ? articleRepo.findVisibleByCategory(category, pageable)
            : articleRepo.findAllVisible(pageable);

        List<Article> articles = new ArrayList<>(result.getContent());

        if (page == 0 && (category == null || category.isBlank())) {
            articleRepo.findFirstPinned().ifPresent(pinned -> {
                articles.removeIf(a -> a.getId().equals(pinned.getId()));
                articles.add(0, pinned);
            });
        }

        return Map.of(
            "articles", articles.stream().map(this::toSummary).toList(),
            "page",     result.getNumber(),
            "hasMore",  result.hasNext(),
            "total",    result.getTotalElements()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        return articleRepo.findById(id)
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElse(ResponseEntity.status(404).body(Map.of("message", "Article not found.")));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody ArticleUpdateRequest req) {
        Article a = articleRepo.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        if (req.getTitle()    != null && !req.getTitle().isBlank())    a.setTitle(req.getTitle());
        if (req.getDek()      != null)                                  a.setDek(req.getDek());
        if (req.getCategory() != null && !req.getCategory().isBlank()) a.setCategory(req.getCategory());
        // Only overwrite cover images if the request actually supplies new ones.
        // An absent or empty image payload is treated as "leave existing images intact"
        // — this prevents a text-only edit from silently destroying the cover image links.
        if (req.getCoverImageUrls() != null && !req.getCoverImageUrls().isEmpty()) {
            a.setCoverImageUrls(req.getCoverImageUrls());
        } else if (req.getCoverImage() != null && !req.getCoverImage().isBlank()) {
            // Single URL convenience field — merge as a one-element list only if
            // the article currently has no images, or the editor explicitly changed it.
            List<String> existing = a.getCoverImageUrls();
            if (existing == null || existing.isEmpty()
                    || !req.getCoverImage().trim().equals(existing.get(0))) {
                a.setCoverImageUrls(List.of(req.getCoverImage().trim()));
            }
        }
        // If neither field is present, coverImageUrls is left untouched.
        if (req.getBody()     != null && !req.getBody().isEmpty())     a.setBody(req.getBody());
        if (req.getVideoUrl() != null)                                 a.setVideoUrl(req.getVideoUrl());
        articleRepo.save(a);
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        if (!articleRepo.existsById(id)) return ResponseEntity.notFound().build();
        articleRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/pin")
    public ResponseEntity<?> pin(@PathVariable String id) {
        Article target = articleRepo.findById(id).orElse(null);
        if (target == null) return ResponseEntity.notFound().build();
        List<Article> all = articleRepo.findAll();
        all.forEach(a -> a.setPinned(false));
        articleRepo.saveAll(all);
        target.setPinned(true);
        articleRepo.save(target);
        return ResponseEntity.ok(Map.of("status", "pinned", "id", id));
    }

    @PutMapping("/{id}/unpin")
    public ResponseEntity<?> unpin(@PathVariable String id) {
        Article a = articleRepo.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        a.setPinned(false);
        articleRepo.save(a);
        return ResponseEntity.ok(Map.of("status", "unpinned", "id", id));
    }

    @PutMapping("/{id}/unpublish")
    public ResponseEntity<?> unpublish(@PathVariable String id) {
        Article a = articleRepo.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        a.setPublished(false);
        a.setPinned(false);
        articleRepo.save(a);
        return ResponseEntity.ok(Map.of("status", "unpublished", "id", id));
    }

    @PutMapping("/{id}/republish")
    public ResponseEntity<?> republish(@PathVariable String id) {
        Article a = articleRepo.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        a.setPublished(true);
        articleRepo.save(a);
        return ResponseEntity.ok(Map.of("status", "republished", "id", id));
    }

    @GetMapping("/search")
    public List<Map<String, Object>> search(@RequestParam(defaultValue = "") String q) {
        if (q.isBlank() || q.length() < 2) return List.of();
        // Pattern.quote() wraps the input in \Q...\E so no regex meta-characters
        // can escape into the MongoDB regex engine — eliminates the ReDoS vector.
        String safe = java.util.regex.Pattern.quote(q.trim());
        return articleRepo.searchVisible(safe, Sort.by(Sort.Direction.DESC, "date"))
            .stream().map(this::toSummary).toList();
    }

    void seed() {
        if (articleRepo.count() > 0) return;
        record S(String id, String title, String cat, String author, String dek,
                 List<String> body, String img, String date) {}
        List<S> seeds = List.of(
            new S("seed-1","The Long Road Home","Fashion","Lior Adeyemi",
                "On the open road, the right coat does more work than any accessory.",
                List.of("There is a particular kind of stillness that arrives somewhere around the third hour of driving, when the radio has been turned off and the landscape has stopped announcing itself.",
                    "The car was borrowed, navy as midnight, the kind of vehicle that makes you sit up straighter. Against it, a heavy wool coat felt less like a styling choice and more like a continuation of the machine.",
                    "What struck me most was how little I needed. One coat, one scarf, a pair of boots broken in years ago.",
                    "By the time the light turned gold and the road curved toward the water, I understood the appeal of dressing for a journey rather than a destination."),
                "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&w=1600&q=80","2026-05-02"),
            new S("seed-2","Notes from the Atelier","Fashion","Marguerite Soto",
                "Inside the small studio where a single tailor still cuts every pattern by hand.",
                List.of("The studio smells like chalk and steam. Bolts of fabric lean against every wall, organized by a logic that only the tailor seems to understand.",
                    "She has worked here for thirty-one years, long enough to have outlasted three landlords and at least two waves of neighbourhood gentrification.",
                    "Every garment that leaves here begins as a conversation — about how someone stands, how they want to be seen walking into a room.",
                    "'Fast is for people in a hurry,' she said. 'I am never in a hurry.'"),
                "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80","2026-04-18"),
            new S("seed-3","The Quiet Hour","Lifestyle","Theo Marchetti",
                "On the small, unglamorous rituals that make a morning feel like your own.",
                List.of("Before the phone, before the news, before the day asks anything of you at all — there is a window of perhaps forty minutes that belongs entirely to you, if you choose to claim it.",
                    "I started protecting this hour almost by accident, after a stretch of mornings so frantic I couldn't remember what I'd eaten for breakfast by lunchtime.",
                    "What filled the space instead was nothing dramatic. Coffee, made slowly. A window opened regardless of weather. Ten minutes with a book.",
                    "The quiet hour doesn't need to be an hour. It barely needs to be quiet. It only needs to be yours."),
                "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1600&q=80","2026-04-02"),
            new S("seed-4","Found Frames","Photography","Priya Nakamura",
                "A street photographer on the discipline of walking without a destination.",
                List.of("The best frame of the day is rarely the one you went out looking for.",
                    "I've stopped planning routes. Instead, I give myself a rule: walk for two hours, in one direction, and don't double back.",
                    "Most of what I shoot never gets shown to anyone. That's by design.",
                    "Every so often, one frame in a few hundred, something arrives that justifies the whole walk."),
                "https://images.unsplash.com/photo-1773332585788-9104ec6f38ef?q=80&w=1170&auto=format&fit=crop","2026-03-21"),
            new S("seed-5","What We Keep","Culture","Eamon Castillo",
                "On the objects we inherit, and the stories attached to them.",
                List.of("In a drawer in my grandmother's house, there was a small tin box of buttons — mismatched, mostly plain, none of them obviously valuable.",
                    "Objects like this resist logic. They aren't valuable in any market sense, and often the story has eroded into something closer to myth than memory.",
                    "What we keep says less about the object than about who we were when we decided not to throw it away.",
                    "I don't know what will happen to the tin when it's my turn to decide. But I understand now that the question was never really about the buttons."),
                "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?auto=format&fit=crop&w=1600&q=80","2026-03-09"),
            new S("seed-6","Coastal Geometry","Photography","Sofia Lindqvist",
                "White walls, hard light, and the architecture that disappears into the horizon.",
                List.of("There's a particular style of building that seems designed to vanish — flat white walls, no ornament, windows placed like punctuation.",
                    "Photographing it is mostly about waiting. The light has to be hard enough to flatten everything into shape and shadow.",
                    "What I like about these buildings is their refusal to compete. They don't try to be the most interesting thing in the frame.",
                    "It's a strange kind of ambition: to design something so quiet it becomes furniture for the horizon."),
                "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=1600&q=80","2026-02-26")
        );
        seeds.forEach(s -> {
            Article a = new Article();
            a.setId(s.id()); a.setTitle(s.title()); a.setCategory(s.cat());
            a.setAuthor(s.author()); a.setDek(s.dek()); a.setBody(s.body());
            a.setCoverImageUrls(List.of(s.img())); a.setDate(Instant.parse(s.date()+"T00:00:00Z"));
            a.setPinned(false); a.setPublished(true);
            articleRepo.save(a);
        });
        log.info("Seeded {} articles.", seeds.size());
    }

  private Map<String, Object> toSummary(Article a) {
    List<String> covers = a.getCoverImageUrls() != null ? a.getCoverImageUrls() : List.of();
    String cover = covers.isEmpty() ? "" : covers.get(0);
    Map<String, Object> map = new HashMap<>();
    map.put("id", a.getId());
    map.put("title", a.getTitle());
    map.put("dek", a.getDek());
    map.put("category", a.getCategory());
    map.put("author", a.getAuthor());
    map.put("coverImage", cover);
    map.put("coverImageUrls", covers);
    map.put("date", a.getDate().toString());
    map.put("pinned", a.isPinned());
    map.put("published", Boolean.TRUE.equals(a.getPublished()));
    return map;
}

    @Data static class ArticleUpdateRequest {
        String title, dek, category, coverImage, richBody, videoUrl;
        List<String> coverImageUrls;
        List<String> body;
    }
}

// ============================================================
// AUTH CONTROLLER
// ============================================================
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
class AuthController {
    private final UserRepository userRepo;
    private final PasswordEncoder encoder;
    private final JwtUtil jwtUtil;
    private final LoginRateLimiter rateLimiter;
    private final PasswordResetTokenRepository resetTokenRepo;

    @Value("${grafide.editor-code}")
    private String editorCode;

    @Value("${grafide.base-url}")
    private String baseUrl;

    @Value("${grafide.mail.from:noreply@grafide.com}")
    private String mailFrom;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Data static class LoginRequest    { @NotBlank String username; @NotBlank String password; }
    @Data static class RegisterRequest {
        @NotBlank @Size(min=3,max=30) String username;
        @NotBlank @Size(min=6)        String password;
        @NotBlank                     String displayName;
        @Email String email;
        String editorCode = "";
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        if (!rateLimiter.isAllowed(req.getUsername())) {
            return ResponseEntity.status(429)
                .body(Map.of("message", "Too many login attempts. Please wait 15 minutes before trying again."));
        }
        User user = userRepo.findByUsername(req.getUsername()).orElse(null);
        if (user == null || !encoder.matches(req.getPassword(), user.getPasswordHash())) {
            return ResponseEntity.status(401)
                .body(Map.of("message", "That username and password combination doesn't match an account."));
        }
        rateLimiter.reset(req.getUsername());
        log.info("Login: {}", user.getUsername());
        return ResponseEntity.ok(Map.of(
            "token",       jwtUtil.generateToken(user.getUsername(), user.getRole()),
            "username",    user.getUsername(),
            "displayName", user.getDisplayName(),
            "role",        user.getRole()
        ));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        if (userRepo.existsByUsername(req.getUsername())) {
            return ResponseEntity.status(409).body(Map.of("message", "That username is already taken."));
        }
        String role = editorCode.equals(req.getEditorCode()) ? "editor" : "creator";
        User user = new User();
        user.setUsername(req.getUsername());
        user.setPasswordHash(encoder.encode(req.getPassword()));
        user.setDisplayName(req.getDisplayName());
        if (req.getEmail() != null && !req.getEmail().isBlank()) user.setEmail(req.getEmail().trim().toLowerCase());
        user.setRole(role);
        userRepo.save(user);
        log.info("Registered {} as {}", user.getUsername(), role);
        return ResponseEntity.ok(Map.of(
            "token",       jwtUtil.generateToken(user.getUsername(), role),
            "username",    user.getUsername(),
            "displayName", user.getDisplayName(),
            "role",        role
        ));
    }

    @Data static class ForgotPasswordRequest  { @NotBlank String username; }
    @Data static class ResetPasswordRequest   { @NotBlank String token; @NotBlank @Size(min=6) String password; }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        User user = userRepo.findByUsername(req.getUsername()).orElse(null);
        String genericOk = "If that username exists and has an email on file, a reset link has been sent. If email is not configured, check the server logs.";
        if (user != null) {
            if (user.getEmail() == null || user.getEmail().isBlank()) {
                processReset(user, true);
            } else {
                processReset(user, false);
            }
        }
        return ResponseEntity.ok(Map.of("message", genericOk));
    }

    private void processReset(User user, boolean logOnly) {
        resetTokenRepo.deleteByUsername(user.getUsername());

        // Raw token — sent in the email URL only, never stored
        String rawToken = UUID.randomUUID().toString().replace("-","")
                        + UUID.randomUUID().toString().replace("-","");

        // Hash the token before persisting so a DB read cannot be weaponised
        String hashedToken;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(rawToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) sb.append(String.format("%02x", b));
            hashedToken = sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }

        PasswordResetToken prt = new PasswordResetToken();
        prt.setToken(hashedToken);           // only the hash lives in MongoDB
        prt.setUsername(user.getUsername());
        prt.setExpiresAt(Instant.now().plusSeconds(3600));
        resetTokenRepo.save(prt);

        String resetUrl = baseUrl + "/reset-password?token=" + rawToken; // raw in link
        if (!logOnly && mailSender != null && user.getEmail() != null) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(mailFrom);
                msg.setTo(user.getEmail());
                msg.setSubject("Reset your Grafide password");
                msg.setText("Hi " + user.getUsername() + ",\n\nReset your Grafide password here:\n\n" + resetUrl + "\n\nThis link expires in 1 hour. If you didn't request this, ignore it.\n\nGrafide");
                mailSender.send(msg);
                log.info("Password reset email sent to {}", user.getEmail());
            } catch (Exception e) {
                log.error("Failed to send reset email: {}", e.getMessage());
                // NOTE: Do NOT log the reset URL here — it leaks an active credential
                log.warn("=== FALLBACK — reset email failed for user: {} ===", user.getUsername());
            }
        } else {
            // Local-dev only: log the URL when email is unconfigured.
            // REMOVE or guard this behind a dev-only profile before deploying to production.
            log.warn("=== EMAIL NOT CONFIGURED — Reset URL for {}: {} ===", user.getUsername(), resetUrl);
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        // The user presents the raw token; hash it to match what is stored in MongoDB
        String hashedToken;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(req.getToken().getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) sb.append(String.format("%02x", b));
            hashedToken = sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            return ResponseEntity.status(500).body(Map.of("message", "Internal error processing reset token."));
        }

        PasswordResetToken prt = resetTokenRepo.findByToken(hashedToken).orElse(null);
        if (prt == null || prt.isUsed() || Instant.now().isAfter(prt.getExpiresAt())) {
            return ResponseEntity.status(400).body(Map.of("message", "This reset link is invalid or has expired. Please request a new one."));
        }
        User user = userRepo.findByUsername(prt.getUsername()).orElse(null);
        if (user == null) return ResponseEntity.status(404).body(Map.of("message", "Account not found."));
        user.setPasswordHash(new BCryptPasswordEncoder().encode(req.getPassword()));
        userRepo.save(user);
        prt.setUsed(true);
        resetTokenRepo.save(prt);
        rateLimiter.reset(user.getUsername());
        log.info("Password reset successful for {}", user.getUsername());
        return ResponseEntity.ok(Map.of("message", "Password updated. You can now sign in."));
    }
}

// ============================================================
// SUBMISSION CONTROLLER
// ============================================================
@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
@Slf4j
class SubmissionController {
    private final SubmissionRepository submissionRepo;
    private final ArticleRepository articleRepo;
    private final UserRepository userRepo;
    private final UploadController uploadController;

    private static final Set<String> VALID_CATEGORIES = Set.of("Fashion", "Lifestyle", "Photography", "Culture", "Podcast");

    private ResponseEntity<?> validateCategory(String category) {
        if (!VALID_CATEGORIES.contains(category)) {
            return ResponseEntity.badRequest().body(Map.of("message",
                "Category must be one of: " + String.join(", ", VALID_CATEGORIES)));
        }
        return null;
    }

    @Data static class SubmissionRequest {
        @NotBlank String title; @NotBlank String dek; @NotBlank String category;
        List<String> body; String richBody; String coverImage = ""; List<String> coverImageUrls; String videoUrl;
    }
    @Data static class ReturnRequest { String note = ""; }

    @PostMapping(consumes = {MediaType.MULTIPART_FORM_DATA_VALUE})
    public ResponseEntity<?> create(@AuthenticationPrincipal String username,
                                    @Valid SubmissionRequest req,
                                    @RequestPart(value = "images", required = false) MultipartFile[] images) {
        ResponseEntity<?> catErr = validateCategory(req.category);
        if (catErr != null) return catErr;
        User user = userRepo.findByUsername(username).orElse(null);
        if (user == null) return ResponseEntity.status(401).build();

        List<String> imageUrls = new ArrayList<>();
        if (req.coverImageUrls != null && !req.coverImageUrls.isEmpty()) {
            req.coverImageUrls.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .forEach(imageUrls::add);
        }
        if (req.coverImage != null && !req.coverImage.isBlank()) {
            imageUrls.add(req.coverImage.trim());
        }
        if (images != null) {
            for (MultipartFile file : images) {
                if (file == null || file.isEmpty()) continue;
                try {
                    imageUrls.add(uploadController.storeImage(file));
                } catch (IOException e) {
                    log.error("Image upload failed: {}", e.getMessage());
                    return ResponseEntity.internalServerError().body(Map.of("message", "Image upload failed."));
                }
            }
        }

        Submission s = new Submission();
        s.setTitle(req.title); s.setDek(req.dek); s.setCategory(req.category);
        s.setBody(req.body); s.setCoverImageUrls(imageUrls); s.setVideoUrl(req.videoUrl);
        s.setAuthor(user.getDisplayName()); s.setSubmitterUsername(username);
        s.setStatus("pending"); s.setNote(""); s.setDate(Instant.now());
        submissionRepo.save(s);
        return ResponseEntity.ok(Map.of("id", s.getId(), "status", "pending"));
    }

    @GetMapping("/mine")
    public List<Submission> mine(@AuthenticationPrincipal String username) {
        return submissionRepo.findBySubmitterUsernameOrderByDateDesc(username);
    }

    @GetMapping("/queue")
    public List<Submission> queue() {
        return submissionRepo.findByStatusOrderByDateDesc("pending");
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        return submissionRepo.findById(id)
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElse(ResponseEntity.status(404).body(Map.of("message", "Not found.")));
    }

    @PutMapping("/{id}/resubmit")
    public ResponseEntity<?> resubmit(
        @PathVariable String id,
        @AuthenticationPrincipal String username,
        @Valid @RequestBody SubmissionRequest req
    ) {
        Submission s = submissionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!s.getSubmitterUsername().equals(username)) {
            return ResponseEntity.status(403).body(Map.of("message", "You can only resubmit your own submissions."));
        }
        ResponseEntity<?> catErr2 = validateCategory(req.category);
        if (catErr2 != null) return catErr2;
        if (!"returned".equals(s.getStatus())) {
            return ResponseEntity.status(400).body(Map.of("message", "Only returned submissions can be resubmitted."));
        }
        s.setTitle(req.title); s.setDek(req.dek); s.setCategory(req.category);
        s.setBody(req.body);
        if (req.coverImageUrls != null && !req.coverImageUrls.isEmpty()) {
            s.setCoverImageUrls(req.coverImageUrls.stream().filter(Objects::nonNull).map(String::trim).filter(s1 -> !s1.isBlank()).toList());
        } else if (req.coverImage != null && !req.coverImage.isBlank()) {
            s.setCoverImageUrls(List.of(req.coverImage.trim()));
        }
        if (req.getVideoUrl() != null) s.setVideoUrl(req.getVideoUrl());
        s.setStatus("pending"); s.setNote(""); s.setDate(Instant.now());
        submissionRepo.save(s);
        return ResponseEntity.ok(Map.of("status", "pending"));
    }

    @DeleteMapping("/{id}/withdraw")
    public ResponseEntity<?> withdraw(@PathVariable String id, @AuthenticationPrincipal String username) {
        Submission s = submissionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!s.getSubmitterUsername().equals(username)) {
            return ResponseEntity.status(403).body(Map.of("message", "You can only withdraw your own submissions."));
        }
        if (!"pending".equals(s.getStatus())) {
            return ResponseEntity.status(400).body(Map.of("message", "Only pending submissions can be withdrawn."));
        }
        submissionRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable String id) {
        Submission s = submissionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        Article a = new Article();
        a.setId(s.getId()); a.setTitle(s.getTitle()); a.setDek(s.getDek());
        a.setCategory(s.getCategory()); a.setAuthor(s.getAuthor()); a.setBody(s.getBody());
        if (s.getCoverImageUrls() != null && !s.getCoverImageUrls().isEmpty()) {
            a.setCoverImageUrls(s.getCoverImageUrls());
        } else {
            a.setCoverImageUrls(List.of("https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=1600&q=80"));
        }
        a.setVideoUrl(s.getVideoUrl());
        a.setDate(Instant.now()); a.setPinned(false); a.setPublished(true);
        articleRepo.save(a);
        s.setStatus("published");
        submissionRepo.save(s);
        return ResponseEntity.ok(Map.of("status", "published"));
    }

    @PutMapping("/{id}/return")
    public ResponseEntity<?> returnToCreator(@PathVariable String id, @RequestBody ReturnRequest req) {
        Submission s = submissionRepo.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        s.setStatus("returned"); s.setNote(req.note != null ? req.note : "");
        submissionRepo.save(s);
        return ResponseEntity.ok(Map.of("status", "returned"));
    }
}

// ============================================================
// SUBSCRIBER CONTROLLER
// ============================================================
@RestController
@RequestMapping("/api/subscribers")
@RequiredArgsConstructor
class SubscriberController {
    private final SubscriberRepository subscriberRepo;

    @Data static class SubscribeRequest { @NotBlank @Email String email; }

    @PostMapping
    public ResponseEntity<?> subscribe(@Valid @RequestBody SubscribeRequest req) {
        String email = req.getEmail().trim().toLowerCase();
        if (subscriberRepo.existsByEmail(email)) {
            return ResponseEntity.ok(Map.of("message", "You're already subscribed — we'll be in touch."));
        }
        Subscriber s = new Subscriber();
        s.setEmail(email); s.setDate(Instant.now());
        subscriberRepo.save(s);
        return ResponseEntity.ok(Map.of("message", "Subscribed. Welcome to Grafide."));
    }

    @GetMapping
    public List<Subscriber> list() {
        return subscriberRepo.findAllByOrderByDateDesc();
    }
}

// ============================================================
// UPLOAD CONTROLLER
// ============================================================
@RestController
@RequestMapping("/api/upload")
@Slf4j
class UploadController {
    @Value("${cloudinary.url:}") private String cloudinaryUrl;
    @Value("${grafide.upload.dir}") private String uploadDir;
    private Cloudinary cloudinary;
    private Path uploadPath;

    @PostConstruct
    void init() throws IOException {
        if (cloudinaryUrl != null && !cloudinaryUrl.isBlank()) {
            cloudinary = new Cloudinary(cloudinaryUrl);
            log.info("Image storage: Cloudinary");
        } else {
            uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(uploadPath);
            log.warn("Image storage: local disk '{}' — LOST on Render redeploy. Set CLOUDINARY_URL.", uploadDir);
        }
    }

    public String storeImage(MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IOException("No file received.");
        String ct = file.getContentType();
        if (ct == null || !ct.startsWith("image/")) throw new IOException("Only image files are accepted.");
        if (cloudinary != null) {
            @SuppressWarnings("unchecked")
            Map<String,Object> result = cloudinary.uploader().upload(file.getBytes(),
                ObjectUtils.asMap("folder","grafide","resource_type","image"));
            return (String) result.get("secure_url");
        } else {
            String original = file.getOriginalFilename();
            String ext = (original != null && original.contains("."))
                ? original.substring(original.lastIndexOf('.')) : ".jpg";
            String filename = UUID.randomUUID() + ext;
            Path dest = uploadPath.resolve(filename).normalize();
            if (!dest.startsWith(uploadPath)) throw new IOException("Invalid filename.");
            file.transferTo(dest);
            return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/upload/images/").path(filename).toUriString();
        }
    }

    @PostMapping("/image")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        try {
            return ResponseEntity.ok(Map.of("url", storeImage(file)));
        } catch (IOException e) {
            log.error("Upload failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("message", "Upload failed: " + e.getMessage()));
        }
    }

    @PostMapping("/inline-image")
    public ResponseEntity<?> uploadInlineImage(@RequestParam("file") MultipartFile file) {
        return upload(file);
    }

    @GetMapping("/images/{filename:.+}")
    public ResponseEntity<Resource> serve(@PathVariable String filename) {
        if (uploadPath == null) return ResponseEntity.notFound().build();
        try {
            Path fp = uploadPath.resolve(filename).normalize();
            if (!fp.startsWith(uploadPath)) return ResponseEntity.badRequest().build();
            Resource r = new UrlResource(fp.toUri());
            if (!r.exists()) return ResponseEntity.notFound().build();
            String ct = Files.probeContentType(fp);
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(ct != null ? ct : "application/octet-stream")).body(r);
        } catch (MalformedURLException e) { return ResponseEntity.badRequest().build();
        } catch (IOException e)           { return ResponseEntity.internalServerError().build(); }
    }
}

// ============================================================
// SECURITY CONFIG
// ============================================================
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
class SecurityConfig {
    private final JwtFilter jwtFilter;

    @Value("${grafide.cors.allowed-origins}")
    private String allowedOrigins;

    @Bean public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
            .cors(c -> c.configurationSource(corsSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/submissions/mine").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/submissions").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/upload/image").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/upload/inline-image").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/submissions/*/resubmit").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/submissions/*/withdraw").authenticated()
                .requestMatchers("/api/submissions/queue").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/submissions/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/articles/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.DELETE, "/api/articles/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.GET,    "/api/subscribers").hasRole("EDITOR")
                .anyRequest().permitAll()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/api/**", config);
        return src;
    }
}

// ============================================================
// JWT FILTER + UTIL
// ============================================================
@Component
@RequiredArgsConstructor
class JwtFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final UserRepository userRepo;

    @Override
    protected void doFilterInternal(
      @NonNull HttpServletRequest req,
      @NonNull HttpServletResponse res,
      @NonNull FilterChain chain)
        throws IOException, jakarta.servlet.ServletException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.isValid(token)) {
                String username = jwtUtil.getUsername(token);
                String role     = jwtUtil.getRole(token);
                if (userRepo.existsByUsername(username)) {
                    SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(username, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))));
                }
            }
        }
        chain.doFilter(req, res);
    }
}

@Component
@Slf4j
class JwtUtil {
    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expiration-ms}") long expirationMs) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            this.key = Keys.hmacShaKeyFor(hash);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }
        this.expirationMs = expirationMs;
        log.info("JwtUtil ready (expiry {}ms)", expirationMs);
    }

    public String generateToken(String username, String role) {
        return Jwts.builder()
            .subject(username)
            .claim("role", role)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expirationMs))
            .signWith(key)
            .compact();
    }
    public Claims parseToken(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
    public boolean isValid(String token) {
        try { parseToken(token); return true; } catch (Exception e) { return false; }
    }
    public String getUsername(String token) { return parseToken(token).getSubject(); }
    public String getRole(String token)     { return (String) parseToken(token).get("role"); }
}

// ============================================================
// DOMAIN MODELS
// ============================================================
@Data @NoArgsConstructor @Document(collection = "articles")
class Article {
    @Id private String id;
    private String title, dek, author, videoUrl;
    private List<String> coverImageUrls = new ArrayList<>();
    @Indexed private String category;
    private List<String> body;
    @Indexed private Instant date;
    private boolean pinned = false;
    private String richBody;
    private Boolean published = true;
}

@Data @NoArgsConstructor @Document(collection = "submissions")
class Submission {
    @Id private String id;
    private String title, dek, category, author, videoUrl;
    private List<String> coverImageUrls = new ArrayList<>();
    private List<String> body;
    private String richBody;
    private String note = "";
    private Instant date;
    private String status;
    private String submitterUsername;
}

@Data @NoArgsConstructor @Document(collection = "users")
class User {
    @Id private String id;
    @Indexed(unique = true) private String username;
    private String passwordHash, displayName;
    private String email;
    private String role = "creator";
}

@Data @NoArgsConstructor @Document(collection = "subscribers")
class Subscriber {
    @Id private String id;
    @Indexed(unique = true) private String email;
    private Instant date;
}

// ============================================================
// REPOSITORIES
// ============================================================
interface ArticleRepository extends MongoRepository<Article, String> {
    @Query("{ '$or': [{'published': true}, {'published': {'$exists': false}}] }")
    Page<Article> findAllVisible(Pageable pageable);

    @Query("{ 'category': ?0, '$or': [{'published': true}, {'published': {'$exists': false}}] }")
    Page<Article> findVisibleByCategory(String category, Pageable pageable);

    @Query(value = "{ 'pinned': true, '$or': [{'published': true}, {'published': {'$exists': false}}] }",
           sort  = "{ 'date': -1 }")
    Optional<Article> findFirstPinned();

    List<Article> findAllByOrderByDateDesc();

    @Query("{ '$and': [ { '$or': [{'published': true}, {'published': {'$exists': false}}] }, { '$or': [{'title': {'$regex': ?0, '$options': 'i'}}, {'dek': {'$regex': ?0, '$options': 'i'}}, {'author': {'$regex': ?0, '$options': 'i'}}, {'category': {'$regex': ?0, '$options': 'i'}}] } ] }")
    List<Article> searchVisible(String query, Sort sort);
}

interface SubmissionRepository extends MongoRepository<Submission, String> {
    List<Submission> findBySubmitterUsernameOrderByDateDesc(String username);
    List<Submission> findByStatusOrderByDateDesc(String status);
}

interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
}

@Data @NoArgsConstructor @Document(collection = "password_reset_tokens")
class PasswordResetToken {
    @Id private String id;
    @Indexed(unique = true) private String token;
    @Indexed private String username;
    private Instant expiresAt;
    private boolean used = false;
}

interface PasswordResetTokenRepository extends MongoRepository<PasswordResetToken, String> {
    Optional<PasswordResetToken> findByToken(String token);
    void deleteByUsername(String username);
}

interface SubscriberRepository extends MongoRepository<Subscriber, String> {
    boolean existsByEmail(String email);
    List<Subscriber> findAllByOrderByDateDesc();
}