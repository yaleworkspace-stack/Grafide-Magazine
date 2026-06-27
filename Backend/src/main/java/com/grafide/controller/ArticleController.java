package com.grafide.controller;

import com.grafide.model.Article;
import com.grafide.repository.ArticleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleRepository articleRepo;

    // ── List (paginated) ─────────────────────────────────────────
    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "12") int size,
            @RequestParam(required = false)    String category) {

        PageRequest pr = PageRequest.of(page, size);
        Page<Article> result = (category != null && !category.isBlank())
                ? articleRepo.findByCategoryAndPublishedTrueOrderByDateDesc(category, pr)
                : articleRepo.findByPublishedTrueOrderByPinnedDescDateDesc(pr);

        return ResponseEntity.ok(Map.of(
                "articles", result.getContent(),
                "hasMore",  !result.isLast(),
                "total",    result.getTotalElements()
        ));
    }

    // ── Get single ───────────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<Article> get(@PathVariable String id) {
        Article article = articleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found."));
        if (!article.isPublished()) {
            throw new IllegalArgumentException("Article not found.");
        }
        return ResponseEntity.ok(article);
    }

    // ── Search ───────────────────────────────────────────────────
    @GetMapping("/search")
    public ResponseEntity<List<Article>> search(@RequestParam String q) {
        if (q == null || q.isBlank()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(articleRepo.searchPublished(q.trim()));
    }

    // ── Update (editor) ──────────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<Article> update(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Article article = articleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found."));

        if (body.containsKey("title"))    article.setTitle((String) body.get("title"));
        if (body.containsKey("dek"))      article.setDek((String) body.get("dek"));
        if (body.containsKey("category")) article.setCategory((String) body.get("category"));
        if (body.containsKey("richBody")) article.setRichBody((String) body.get("richBody"));

        @SuppressWarnings("unchecked")
        List<String> covers = (List<String>) body.get("coverImageUrls");
        if (covers != null) article.setCoverImageUrls(covers);

        return ResponseEntity.ok(articleRepo.save(article));
    }

    // ── Pin / Unpin ──────────────────────────────────────────────
    @PutMapping("/{id}/pin")
    public ResponseEntity<Map<String, String>> pin(@PathVariable String id) {
        Article article = articleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found."));
        article.setPinned(true);
        articleRepo.save(article);
        return ResponseEntity.ok(Map.of("message", "Article pinned as cover story."));
    }

    @PutMapping("/{id}/unpin")
    public ResponseEntity<Map<String, String>> unpin(@PathVariable String id) {
        Article article = articleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found."));
        article.setPinned(false);
        articleRepo.save(article);
        return ResponseEntity.ok(Map.of("message", "Article unpinned."));
    }

    // ── Unpublish / Republish ─────────────────────────────────────
    @PutMapping("/{id}/unpublish")
    public ResponseEntity<Map<String, String>> unpublish(@PathVariable String id) {
        Article article = articleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found."));
        article.setPublished(false);
        articleRepo.save(article);
        return ResponseEntity.ok(Map.of("message", "Article unpublished."));
    }

    @PutMapping("/{id}/republish")
    public ResponseEntity<Map<String, String>> republish(@PathVariable String id) {
        Article article = articleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Article not found."));
        article.setPublished(true);
        articleRepo.save(article);
        return ResponseEntity.ok(Map.of("message", "Article republished."));
    }

    // ── Delete ───────────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable String id) {
        if (!articleRepo.existsById(id)) {
            throw new IllegalArgumentException("Article not found.");
        }
        articleRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Article deleted."));
    }

    // ── Health ───────────────────────────────────────────────────
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
