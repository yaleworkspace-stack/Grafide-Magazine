package com.grafide.controller;

import com.grafide.model.Subscriber;
import com.grafide.repository.SubscriberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/subscribers")
@RequiredArgsConstructor
public class SubscriberController {

    private final SubscriberRepository subscriberRepo;

    @PostMapping
    public ResponseEntity<Map<String, String>> subscribe(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        if (email.isBlank() || !email.contains("@")) {
            throw new IllegalArgumentException("Please provide a valid email address.");
        }
        if (subscriberRepo.existsByEmail(email)) {
            return ResponseEntity.ok(Map.of("message", "You're already subscribed — thank you!"));
        }
        Subscriber sub = new Subscriber();
        sub.setEmail(email);
        subscriberRepo.save(sub);
        return ResponseEntity.ok(Map.of("message", "You're subscribed — welcome to Grafide!"));
    }

    @GetMapping
    public ResponseEntity<List<Subscriber>> list() {
        return ResponseEntity.ok(subscriberRepo.findAll());
    }
}
