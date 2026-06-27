package com.grafide.controller;

import com.grafide.model.Magazine;
import com.grafide.repository.MagazineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/magazines")
@RequiredArgsConstructor
public class MagazineController {

    private final MagazineRepository magazineRepo;

    @GetMapping
    public ResponseEntity<List<Magazine>> list() {
        return ResponseEntity.ok(magazineRepo.findAllByOrderByUploadedAtDesc());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Magazine> get(@PathVariable String id) {
        Magazine mag = magazineRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Issue not found."));
        return ResponseEntity.ok(mag);
    }

    @PostMapping
    public ResponseEntity<Magazine> create(@RequestBody Magazine magazine) {
        return ResponseEntity.ok(magazineRepo.save(magazine));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable String id) {
        if (!magazineRepo.existsById(id)) {
            throw new IllegalArgumentException("Issue not found.");
        }
        magazineRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Issue deleted."));
    }
}
