package com.grafide.controller;

import com.grafide.model.*;
import com.grafide.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderRepository   orderRepo;
    private final ProductRepository productRepo;
    private final UserRepository    userRepo;

    @Value("${grafide.shop.shipping-fee:2500}")
    private double shippingFee;

    // ── Place order (authenticated) ───────────────────────────────
    @PostMapping
    public ResponseEntity<Map<String, Object>> place(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User user = userRepo.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        // Validate shipping info
        String shippingName    = required(body, "shippingName");
        String shippingPhone   = required(body, "shippingPhone");
        String shippingAddress = required(body, "shippingAddress");
        String shippingCity    = required(body, "shippingCity");
        String shippingState   = required(body, "shippingState");

        // Build order items
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cartItems = (List<Map<String, Object>>) body.get("items");
        if (cartItems == null || cartItems.isEmpty()) {
            throw new IllegalArgumentException("Cart is empty.");
        }

        List<OrderItem> orderItems = new ArrayList<>();
        double subtotal = 0;

        for (Map<String, Object> ci : cartItems) {
            String productId = (String) ci.get("productId");
            int    qty       = ((Number) ci.get("quantity")).intValue();

            if (qty <= 0) throw new IllegalArgumentException("Quantity must be at least 1.");

            Product p = productRepo.findById(productId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Product not found: " + productId));

            if (!p.isPublished()) {
                throw new IllegalArgumentException(p.getTitle() + " is no longer available.");
            }
            if (p.isOutOfStock() || p.getStock() < qty) {
                throw new IllegalArgumentException(
                        p.getTitle() + " does not have enough stock.");
            }

            // Decrement stock
            p.setStock(p.getStock() - qty);
            p.setOutOfStock(p.getStock() <= 0);
            productRepo.save(p);

            double itemSubtotal      = p.getPrice() * qty;
            double commissionAmount  = itemSubtotal * (p.getCommissionRate() / 100.0);
            double brandPayout       = itemSubtotal - commissionAmount;

            OrderItem oi = new OrderItem();
            oi.setProductId(p.getId());
            oi.setProductTitle(p.getTitle());
            oi.setImageUrl(p.getImageUrls().isEmpty() ? "" : p.getImageUrls().get(0));
            oi.setUnitPrice(p.getPrice());
            oi.setQuantity(qty);
            oi.setSubtotal(itemSubtotal);
            oi.setBrandId(p.getBrandId());
            oi.setBrandName(p.getOwnerName());
            oi.setCommissionRate(p.getCommissionRate());
            oi.setCommissionAmount(commissionAmount);
            oi.setBrandPayout(brandPayout);

            orderItems.add(oi);
            subtotal += itemSubtotal;
        }

        double total = subtotal + shippingFee;

        // Create order
        Order order = new Order();
        order.setCustomerId(user.getId());
        order.setCustomerName(user.getDisplayName());
        order.setCustomerEmail(user.getEmail());
        order.setItems(orderItems);
        order.setSubtotal(subtotal);
        order.setShippingFee(shippingFee);
        order.setTotal(total);
        order.setShippingName(shippingName);
        order.setShippingPhone(shippingPhone);
        order.setShippingAddress(shippingAddress);
        order.setShippingCity(shippingCity);
        order.setShippingState(shippingState);
        order.setStatus("PENDING");

        orderRepo.save(order);

        Map<String, Object> resp = new HashMap<>();
        resp.put("orderId",     order.getId());
        resp.put("total",       total);
        resp.put("subtotal",    subtotal);
        resp.put("shippingFee", shippingFee);
        return ResponseEntity.ok(resp);
    }

    // ── Customer: my orders ───────────────────────────────────────
    @GetMapping("/mine")
    public ResponseEntity<List<Order>> mine(Authentication auth) {
        User user = userRepo.findByUsername(auth.getName()).orElseThrow();
        return ResponseEntity.ok(orderRepo.findByCustomerIdOrderByCreatedAtDesc(user.getId()));
    }

    // ── Customer: get single order ────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<Order> get(@PathVariable String id, Authentication auth) {
        Order order = orderRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Order not found."));
        User user = userRepo.findByUsername(auth.getName()).orElseThrow();
        boolean isEditor = "editor".equals(user.getRole());
        if (!isEditor && !order.getCustomerId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied.");
        }
        return ResponseEntity.ok(order);
    }

    // ── Editor: all orders ────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<Order>> all(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(
            status != null
                ? orderRepo.findByStatusOrderByCreatedAtDesc(status)
                : orderRepo.findAllByOrderByCreatedAtDesc()
        );
    }

    // ── Editor: update fulfillment status ─────────────────────────
    @PutMapping("/{id}/status")
    public ResponseEntity<Map<String, String>> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {

        Order order = orderRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Order not found."));

        String newStatus = body.getOrDefault("status", "").toUpperCase();
        Set<String> valid = Set.of("PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED");
        if (!valid.contains(newStatus)) {
            throw new IllegalArgumentException("Invalid status. Use: PROCESSING, SHIPPED, DELIVERED, CANCELLED.");
        }

        order.setStatus(newStatus);
        if ("SHIPPED".equals(newStatus))    order.setShippedAt(Instant.now());
        if ("DELIVERED".equals(newStatus))  order.setDeliveredAt(Instant.now());

        // If cancelled, restore stock
        if ("CANCELLED".equals(newStatus) && !"CANCELLED".equals(order.getStatus())) {
            for (OrderItem item : order.getItems()) {
                productRepo.findById(item.getProductId()).ifPresent(p -> {
                    p.setStock(p.getStock() + item.getQuantity());
                    p.setOutOfStock(false);
                    productRepo.save(p);
                });
            }
        }

        orderRepo.save(order);
        return ResponseEntity.ok(Map.of("message", "Order status updated to " + newStatus + "."));
    }

    // ── Helpers ───────────────────────────────────────────────────
    private String required(Map<String, Object> body, String key) {
        String val = (String) body.get(key);
        if (val == null || val.trim().isBlank()) {
            throw new IllegalArgumentException(key + " is required.");
        }
        return val.trim();
    }
}
