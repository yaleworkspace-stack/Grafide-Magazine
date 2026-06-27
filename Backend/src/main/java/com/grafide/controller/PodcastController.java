package com.grafide.controller;

import com.grafide.model.Podcast;
import com.grafide.repository.PodcastRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/podcasts")
@RequiredArgsConstructor
public class PodcastController {

    private final PodcastRepository podcastRepo;

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<Podcast> result = podcastRepo.findAllByOrderByDateDesc(PageRequest.of(page, size));
        return ResponseEntity.ok(Map.of(
                "episodes", result.getContent(),
                "hasMore",  !result.isLast()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Podcast> get(@PathVariable String id) {
        Podcast ep = podcastRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Episode not found."));
        return ResponseEntity.ok(ep);
    }

    @PostMapping
    public ResponseEntity<Podcast> create(@RequestBody Podcast podcast) {
        return ResponseEntity.ok(podcastRepo.save(podcast));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable String id) {
        if (!podcastRepo.existsById(id)) {
            throw new IllegalArgumentException("Episode not found.");
        }
        podcastRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Episode deleted."));
    }
}
