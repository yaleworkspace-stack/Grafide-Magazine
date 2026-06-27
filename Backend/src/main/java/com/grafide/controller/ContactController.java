package com.grafide.controller;

import com.grafide.model.ContactMessage;
import com.grafide.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/contact")
@RequiredArgsConstructor
public class ContactController {

    private final ContactRepository contactRepo;

    @PostMapping
    public ResponseEntity<Map<String, String>> send(@RequestBody Map<String, String> body) {
        String name    = body.getOrDefault("name",    "").trim();
        String email   = body.getOrDefault("email",   "").trim();
        String subject = body.getOrDefault("subject", "").trim();
        String message = body.getOrDefault("message", "").trim();

        if (name.isBlank() || email.isBlank() || subject.isBlank() || message.isBlank()) {
            throw new IllegalArgumentException("All fields are required.");
        }
        if (!email.contains("@")) {
            throw new IllegalArgumentException("Please provide a valid email address.");
        }

        ContactMessage msg = new ContactMessage();
        msg.setName(name);
        msg.setEmail(email);
        msg.setSubject(subject);
        msg.setMessage(message);
        contactRepo.save(msg);

        return ResponseEntity.ok(Map.of("message",
                "Thank you for reaching out! We'll get back to you as soon as possible."));
    }

    // Editor-only: view all messages
    @GetMapping
    public ResponseEntity<List<ContactMessage>> list() {
        return ResponseEntity.ok(contactRepo.findAllByOrderByReceivedAtDesc());
    }

    // Mark as read
    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, String>> markRead(@PathVariable String id) {
        ContactMessage msg = contactRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Message not found."));
        msg.setRead(true);
        contactRepo.save(msg);
        return ResponseEntity.ok(Map.of("message", "Marked as read."));
    }
}
