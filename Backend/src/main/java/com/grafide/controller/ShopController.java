package com.grafide.controller;

import com.grafide.model.Brand;
import com.grafide.model.Product;
import com.grafide.repository.BrandRepository;
import com.grafide.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/shop/products")
@RequiredArgsConstructor
public class ShopController {

    private final ProductRepository productRepo;
    private final BrandRepository   brandRepo;

    private static final Set<String> VALID_CATEGORIES =
            Set.of("Magazine Issues", "Apparel", "Accessories", "Beauty");

    // ── Public: list (paginated, optional category filter) ────────
    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "12") int size,
            @RequestParam(required = false)    String category) {

        PageRequest pr = PageRequest.of(page, size);
        Page<Product> result = (category != null && !category.isBlank())
                ? productRepo.findByCategoryAndPublishedTrueOrderByCreatedAtDesc(category, pr)
                : productRepo.findByPublishedTrueOrderByCreatedAtDesc(pr);

        return ResponseEntity.ok(Map.of(
                "products", result.getContent(),
                "hasMore",  !result.isLast(),
                "total",    result.getTotalElements()
        ));
    }

    // ── Public: get single ────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<Product> get(@PathVariable String id) {
        Product p = productRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found."));
        if (!p.isPublished()) throw new IllegalArgumentException("Product not found.");
        return ResponseEntity.ok(p);
    }

    // ── Public: search ────────────────────────────────────────────
    @GetMapping("/search")
    public ResponseEntity<List<Product>> search(@RequestParam String q) {
        if (q == null || q.isBlank()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(productRepo.searchPublished(q.trim()));
    }

    // ── Editor: create product ────────────────────────────────────
    @PostMapping
    public ResponseEntity<Product> create(@RequestBody Map<String, Object> body) {
        Product p = buildProduct(body, new Product());
        return ResponseEntity.ok(productRepo.save(p));
    }

    // ── Editor: update product ────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<Product> update(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {

        Product p = productRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found."));
        buildProduct(body, p);
        return ResponseEntity.ok(productRepo.save(p));
    }

    // ── Editor: toggle publish ────────────────────────────────────
    @PutMapping("/{id}/publish")
    public ResponseEntity<Map<String, String>> togglePublish(@PathVariable String id) {
        Product p = productRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found."));
        p.setPublished(!p.isPublished());
        productRepo.save(p);
        return ResponseEntity.ok(Map.of("message",
                p.isPublished() ? "Product published." : "Product unpublished."));
    }

    // ── Editor: delete ────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable String id) {
        if (!productRepo.existsById(id)) throw new IllegalArgumentException("Product not found.");
        productRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Product deleted."));
    }

    // ── Helpers ───────────────────────────────────────────────────
    private Product buildProduct(Map<String, Object> body, Product p) {
        if (body.containsKey("title"))       p.setTitle((String) body.get("title"));
        if (body.containsKey("description")) p.setDescription((String) body.get("description"));
        if (body.containsKey("category")) {
            String cat = (String) body.get("category");
            if (!VALID_CATEGORIES.contains(cat)) {
                throw new IllegalArgumentException(
                    "Invalid category. Must be: Magazine Issues, Apparel, Accessories, or Beauty.");
            }
            p.setCategory(cat);
        }
        if (body.containsKey("price")) {
            double price = ((Number) body.get("price")).doubleValue();
            if (price < 0) throw new IllegalArgumentException("Price cannot be negative.");
            p.setPrice(price);
        }
        if (body.containsKey("stock")) {
            int stock = ((Number) body.get("stock")).intValue();
            p.setStock(stock);
            p.setOutOfStock(stock <= 0);
        }
        if (body.containsKey("published")) p.setPublished((Boolean) body.get("published"));

        @SuppressWarnings("unchecked")
        List<String> images = (List<String>) body.get("imageUrls");
        if (images != null) p.setImageUrls(images);

        // Brand linkage (if brandId provided, pull commission rate from brand)
        String brandId = (String) body.get("brandId");
        if (brandId != null && !brandId.isBlank()) {
            Brand brand = brandRepo.findById(brandId)
                    .orElseThrow(() -> new IllegalArgumentException("Brand not found."));
            if (!"approved".equals(brand.getStatus())) {
                throw new IllegalArgumentException("Brand must be approved before listing products.");
            }
            p.setBrandId(brand.getId());
            p.setOwnerName(brand.getName());
            p.setCommissionRate(brand.getCommissionRate());
        } else {
            // Grafide's own product
            p.setBrandId(null);
            p.setOwnerName("Grafide");
            p.setCommissionRate(100.0); // 100% goes to Grafide
        }

        return p;
    }
}
