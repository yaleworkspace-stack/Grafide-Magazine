package com.grafide.controller;

import com.grafide.model.Brand;
import com.grafide.repository.BrandRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/brands")
@RequiredArgsConstructor
public class BrandController {

    private final BrandRepository brandRepo;

    // ── Public: apply ─────────────────────────────────────────────
    @PostMapping("/apply")
    public ResponseEntity<Map<String, String>> apply(@RequestBody Map<String, String> body) {
        String name        = body.getOrDefault("name",        "").trim();
        String email       = body.getOrDefault("email",       "").trim().toLowerCase();
        String contactName = body.getOrDefault("contactName", "").trim();
        String description = body.getOrDefault("description", "").trim();

        if (name.isBlank() || email.isBlank() || contactName.isBlank()) {
            throw new IllegalArgumentException("Brand name, contact name and email are required.");
        }
        if (!email.contains("@")) {
            throw new IllegalArgumentException("Please provide a valid email address.");
        }
        if (brandRepo.existsByEmail(email)) {
            throw new IllegalArgumentException(
                "An application with that email already exists. We'll be in touch.");
        }

        Brand brand = new Brand();
        brand.setName(name);
        brand.setEmail(email);
        brand.setContactName(contactName);
        brand.setDescription(description);
        brand.setWebsite(body.getOrDefault("website",   "").trim());
        brand.setInstagram(body.getOrDefault("instagram", "").trim());

        brandRepo.save(brand);
        return ResponseEntity.ok(Map.of("message",
            "Application received! We'll review it and get back to you within 3–5 business days."));
    }

    // ── Editor: list all ──────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<Brand>> list(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(
            status != null
                ? brandRepo.findByStatusOrderByAppliedAtDesc(status)
                : brandRepo.findAllByOrderByAppliedAtDesc()
        );
    }

    // ── Editor: get single ────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<Brand> get(@PathVariable String id) {
        Brand brand = brandRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Brand not found."));
        return ResponseEntity.ok(brand);
    }

    // ── Editor: approve ───────────────────────────────────────────
    @PutMapping("/{id}/approve")
    public ResponseEntity<Map<String, String>> approve(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {

        Brand brand = brandRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Brand not found."));

        double rate = body.containsKey("commissionRate")
                ? ((Number) body.get("commissionRate")).doubleValue()
                : 15.0;

        if (rate < 0 || rate > 100) {
            throw new IllegalArgumentException("Commission rate must be between 0 and 100.");
        }

        brand.setStatus("approved");
        brand.setCommissionRate(rate);
        brand.setReviewedAt(Instant.now());
        brandRepo.save(brand);

        return ResponseEntity.ok(Map.of("message",
            "Brand approved with " + rate + "% commission rate."));
    }

    // ── Editor: reject ────────────────────────────────────────────
    @PutMapping("/{id}/reject")
    public ResponseEntity<Map<String, String>> reject(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {

        Brand brand = brandRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Brand not found."));

        brand.setStatus("rejected");
        brand.setEditorNote(body.getOrDefault("note", "").trim());
        brand.setReviewedAt(Instant.now());
        brandRepo.save(brand);

        return ResponseEntity.ok(Map.of("message", "Brand application rejected."));
    }

    // ── Editor: update commission rate ────────────────────────────
    @PutMapping("/{id}/commission")
    public ResponseEntity<Map<String, String>> updateCommission(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {

        Brand brand = brandRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Brand not found."));

        double rate = ((Number) body.get("commissionRate")).doubleValue();
        if (rate < 0 || rate > 100) {
            throw new IllegalArgumentException("Commission rate must be between 0 and 100.");
        }

        brand.setCommissionRate(rate);
        brandRepo.save(brand);
        return ResponseEntity.ok(Map.of("message", "Commission rate updated."));
    }

    // ── Editor: delete ────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable String id) {
        if (!brandRepo.existsById(id)) {
            throw new IllegalArgumentException("Brand not found.");
        }
        brandRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Brand removed."));
    }
}
