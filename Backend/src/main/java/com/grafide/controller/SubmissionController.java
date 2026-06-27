package com.grafide.controller;

import com.grafide.model.Article;
import com.grafide.model.Submission;
import com.grafide.model.User;
import com.grafide.repository.ArticleRepository;
import com.grafide.repository.SubmissionRepository;
import com.grafide.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionRepository submissionRepo;
    private final ArticleRepository    articleRepo;
    private final UserRepository       userRepo;

    // ── Submit new article ────────────────────────────────────────
    @PostMapping
    public ResponseEntity<Map<String, String>> create(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User user = userRepo.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        String title    = (String) body.get("title");
        String category = (String) body.get("category");
        if (title == null || title.isBlank() || category == null || category.isBlank()) {
            throw new IllegalArgumentException("Title and category are required.");
        }

        validateCategory(category);

        Submission sub = new Submission();
        sub.setTitle(title);
        sub.setDek((String) body.get("dek"));
        sub.setCategory(category);
        sub.setRichBody((String) body.get("richBody"));
        sub.setAuthorId(user.getId());
        sub.setAuthorUsername(user.getUsername());
        sub.setAuthorDisplayName(user.getDisplayName());

        @SuppressWarnings("unchecked")
        List<String> covers = (List<String>) body.get("coverImageUrls");
        if (covers != null) sub.setCoverImageUrls(covers);

        submissionRepo.save(sub);
        return ResponseEntity.ok(Map.of("message",
                "Submission received. Our editors will review it shortly."));
    }

    // ── My submissions ────────────────────────────────────────────
    @GetMapping("/mine")
    public ResponseEntity<List<Submission>> mine(Authentication auth) {
        User user = userRepo.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found."));
        return ResponseEntity.ok(submissionRepo.findByAuthorIdOrderBySubmittedAtDesc(user.getId()));
    }

    // ── Review queue (editor) ─────────────────────────────────────
    @GetMapping("/queue")
    public ResponseEntity<List<Submission>> queue() {
        return ResponseEntity.ok(submissionRepo.findByStatusOrderBySubmittedAtAsc("pending"));
    }

    // ── Get single (author or editor) ─────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<Submission> get(@PathVariable String id, Authentication auth) {
        Submission sub = submissionRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found."));
        User user = userRepo.findByUsername(auth.getName()).orElseThrow();
        boolean isEditor = "editor".equals(user.getRole());
        if (!isEditor && !sub.getAuthorId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied.");
        }
        return ResponseEntity.ok(sub);
    }

    // ── Approve → publish as article (editor) ────────────────────
    @PutMapping("/{id}/approve")
    public ResponseEntity<Map<String, String>> approve(@PathVariable String id) {
        Submission sub = submissionRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found."));

        Article article = new Article();
        article.setTitle(sub.getTitle());
        article.setDek(sub.getDek());
        article.setCategory(sub.getCategory());
        article.setRichBody(sub.getRichBody());
        article.setCoverImageUrls(sub.getCoverImageUrls());
        article.setAuthor(sub.getAuthorDisplayName());
        article.setAuthorId(sub.getAuthorId());
        article.setPublished(true);

        articleRepo.save(article);

        sub.setStatus("approved");
        sub.setReviewedAt(Instant.now());
        submissionRepo.save(sub);

        return ResponseEntity.ok(Map.of("message", "Submission approved and published."));
    }

    // ── Return to author with note (editor) ───────────────────────
    @PutMapping("/{id}/return")
    public ResponseEntity<Map<String, String>> returnToAuthor(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {

        String note = body.getOrDefault("note", "").trim();
        if (note.isBlank()) {
            throw new IllegalArgumentException("An editor note is required when returning a submission.");
        }

        Submission sub = submissionRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found."));
        sub.setStatus("returned");
        sub.setEditorNote(note);
        sub.setReviewedAt(Instant.now());
        submissionRepo.save(sub);

        return ResponseEntity.ok(Map.of("message", "Submission returned to author."));
    }

    // ── Resubmit after return (author) ────────────────────────────
    @PutMapping("/{id}/resubmit")
    public ResponseEntity<Map<String, String>> resubmit(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Submission sub = submissionRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found."));
        User user = userRepo.findByUsername(auth.getName()).orElseThrow();

        if (!sub.getAuthorId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied.");
        }
        if (!"returned".equals(sub.getStatus())) {
            throw new IllegalArgumentException("Only returned submissions can be resubmitted.");
        }

        if (body.containsKey("title"))    sub.setTitle((String) body.get("title"));
        if (body.containsKey("dek"))      sub.setDek((String) body.get("dek"));
        if (body.containsKey("category")) {
            validateCategory((String) body.get("category"));
            sub.setCategory((String) body.get("category"));
        }
        if (body.containsKey("richBody")) sub.setRichBody((String) body.get("richBody"));

        sub.setStatus("pending");
        sub.setEditorNote(null);
        sub.setSubmittedAt(Instant.now());
        submissionRepo.save(sub);

        return ResponseEntity.ok(Map.of("message", "Resubmitted successfully."));
    }

    // ── Withdraw (author, pending only) ───────────────────────────
    @DeleteMapping("/{id}/withdraw")
    public ResponseEntity<Map<String, String>> withdraw(
            @PathVariable String id,
            Authentication auth) {

        Submission sub = submissionRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found."));
        User user = userRepo.findByUsername(auth.getName()).orElseThrow();

        if (!sub.getAuthorId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied.");
        }
        if (!"pending".equals(sub.getStatus())) {
            throw new IllegalArgumentException("Only pending submissions can be withdrawn.");
        }

        sub.setStatus("withdrawn");
        submissionRepo.save(sub);
        return ResponseEntity.ok(Map.of("message", "Submission withdrawn."));
    }

    // ── Helpers ───────────────────────────────────────────────────
    private static final Set<String> VALID_CATEGORIES =
            Set.of("Fashion", "Lifestyle", "Photography", "Culture");

    private void validateCategory(String category) {
        if (!VALID_CATEGORIES.contains(category)) {
            throw new IllegalArgumentException(
                    "Invalid category. Must be one of: Fashion, Lifestyle, Photography, Culture.");
        }
    }
}
