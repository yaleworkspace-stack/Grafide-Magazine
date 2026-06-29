package com.grafide.controller;

import com.grafide.model.PortfolioItem;
import com.grafide.repository.PortfolioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/portfolio")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioRepository portfolioRepo;

    @GetMapping
    public ResponseEntity<List<PortfolioItem>> list(
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(
            category != null && !category.isBlank()
                ? portfolioRepo.findByCategoryOrderBySortOrderAsc(category)
                : portfolioRepo.findAllByOrderBySortOrderAscCreatedAtDesc()
        );
    }

    @GetMapping("/featured")
    public ResponseEntity<List<PortfolioItem>> featured() {
        return ResponseEntity.ok(portfolioRepo.findByFeaturedTrueOrderBySortOrderAsc());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PortfolioItem> get(@PathVariable String id) {
        return ResponseEntity.ok(portfolioRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Item not found.")));
    }

    @PostMapping
    public ResponseEntity<PortfolioItem> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(portfolioRepo.save(buildItem(body, new PortfolioItem())));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PortfolioItem> update(
            @PathVariable String id, @RequestBody Map<String, Object> body) {
        PortfolioItem item = portfolioRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Item not found."));
        return ResponseEntity.ok(portfolioRepo.save(buildItem(body, item)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable String id) {
        portfolioRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted."));
    }

    private PortfolioItem buildItem(Map<String, Object> body, PortfolioItem item) {
        if (body.containsKey("title"))       item.setTitle((String) body.get("title"));
        if (body.containsKey("category"))    item.setCategory((String) body.get("category"));
        if (body.containsKey("client"))      item.setClient((String) body.get("client"));
        if (body.containsKey("description")) item.setDescription((String) body.get("description"));
        if (body.containsKey("coverUrl"))    item.setCoverUrl((String) body.get("coverUrl"));
        if (body.containsKey("featured"))    item.setFeatured((Boolean) body.get("featured"));
        if (body.containsKey("sortOrder"))   item.setSortOrder(((Number) body.get("sortOrder")).intValue());
        @SuppressWarnings("unchecked")
        List<String> imgs = (List<String>) body.get("imageUrls");
        if (imgs != null) item.setImageUrls(imgs);
        return item;
    }
}
