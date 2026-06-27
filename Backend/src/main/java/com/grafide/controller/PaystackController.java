package com.grafide.controller;

import com.grafide.model.Order;
import com.grafide.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/paystack")
@RequiredArgsConstructor
public class PaystackController {

    private final OrderRepository orderRepo;

    @Value("${paystack.secret-key}")
    private String secretKey;

    @Value("${grafide.base-url}")
    private String baseUrl;

    private static final String PAYSTACK_INIT_URL   = "https://api.paystack.co/transaction/initialize";
    private static final String PAYSTACK_VERIFY_URL  = "https://api.paystack.co/transaction/verify/";

    // ── Initiate payment ──────────────────────────────────────────
    // Called after /api/orders creates the order (status=PENDING)
    @PostMapping("/initiate")
    public ResponseEntity<Map<String, Object>> initiate(
            @RequestBody Map<String, String> body,
            Authentication auth) {

        String orderId = body.get("orderId");
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId is required.");
        }

        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found."));

        // Only the order owner can pay
        if (!order.getCustomerId().equals(getUserId(auth))) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied.");
        }
        if (!"PENDING".equals(order.getStatus())) {
            throw new IllegalArgumentException("This order has already been paid or cancelled.");
        }

        // Generate unique reference
        String reference = "GRF-" + orderId.substring(0, Math.min(8, orderId.length())).toUpperCase()
                + "-" + System.currentTimeMillis();

        // Paystack expects amount in kobo (1 Naira = 100 kobo)
        long amountKobo = Math.round(order.getTotal() * 100);

        Map<String, Object> payload = new HashMap<>();
        payload.put("email",     order.getCustomerEmail());
        payload.put("amount",    amountKobo);
        payload.put("reference", reference);
        payload.put("currency",  "NGN");
        payload.put("callback_url", baseUrl + "/api/paystack/callback");
        payload.put("metadata", Map.of(
                "orderId",      order.getId(),
                "customerName", order.getCustomerName()
        ));

        // Call Paystack API
        RestTemplate rest    = new RestTemplate();
        HttpHeaders  headers = new HttpHeaders();
        headers.setBearerAuth(secretKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<Map> response = rest.postForEntity(
                    PAYSTACK_INIT_URL,
                    new HttpEntity<>(payload, headers),
                    Map.class
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");

            String authUrl  = (String) data.get("authorization_url");
            String paystackRef = (String) data.get("reference");

            // Save reference to order
            order.setPaystackReference(paystackRef);
            order.setPaystackAuthUrl(authUrl);
            orderRepo.save(order);

            return ResponseEntity.ok(Map.of(
                    "authorizationUrl", authUrl,
                    "reference",        paystackRef
            ));

        } catch (Exception e) {
            throw new RuntimeException("Failed to initiate payment. Please try again.");
        }
    }

    // ── Webhook (Paystack POSTs here on payment events) ───────────
    // Must be public — Paystack doesn't send auth headers
    @PostMapping("/webhook")
    public ResponseEntity<String> webhook(
            @RequestHeader(value = "x-paystack-signature", required = false) String signature,
            @RequestBody String rawBody) {

        // Verify HMAC-SHA512 signature
        if (!verifySignature(rawBody, signature)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature.");
        }

        try {
            // Parse event
            Map<?, ?> event = parseJson(rawBody);
            String eventType = (String) event.get("event");

            if ("charge.success".equals(eventType)) {
                @SuppressWarnings("unchecked")
                Map<String, Object> data = (Map<String, Object>) event.get("data");
                String reference = (String) data.get("reference");
                String status    = (String) data.get("status");

                if ("success".equals(status) && reference != null) {
                    orderRepo.findByPaystackReference(reference).ifPresent(order -> {
                        if ("PENDING".equals(order.getStatus())) {
                            order.setStatus("PAID");
                            order.setPaidAt(Instant.now());
                            orderRepo.save(order);
                        }
                    });
                }
            }
        } catch (Exception e) {
            System.err.println("[Grafide] Webhook parse error: " + e.getMessage());
        }

        // Always return 200 to Paystack
        return ResponseEntity.ok("OK");
    }

    // ── Callback (browser redirected here after payment) ──────────
    // Verifies the payment server-side then redirects customer to orders page
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam String reference) {
        // Verify with Paystack API
        RestTemplate rest    = new RestTemplate();
        HttpHeaders  headers = new HttpHeaders();
        headers.setBearerAuth(secretKey);

        try {
            ResponseEntity<Map> response = rest.exchange(
                    PAYSTACK_VERIFY_URL + reference,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    Map.class
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
            String status = (String) data.get("status");

            if ("success".equals(status)) {
                orderRepo.findByPaystackReference(reference).ifPresent(order -> {
                    if ("PENDING".equals(order.getStatus())) {
                        order.setStatus("PAID");
                        order.setPaidAt(Instant.now());
                        orderRepo.save(order);
                    }
                });
                // Redirect to orders page with success flag
                HttpHeaders redirect = new HttpHeaders();
                redirect.setLocation(java.net.URI.create(
                        baseUrl.replace(":8080", ":5500")
                        + "/pages/orders.html?payment=success&ref=" + reference));
                return ResponseEntity.status(HttpStatus.FOUND).headers(redirect).build();
            }
        } catch (Exception e) {
            System.err.println("[Grafide] Callback verify error: " + e.getMessage());
        }

        // Payment failed — redirect with error flag
        HttpHeaders redirect = new HttpHeaders();
        redirect.setLocation(java.net.URI.create(
                baseUrl.replace(":8080", ":5500")
                + "/pages/cart.html?payment=failed"));
        return ResponseEntity.status(HttpStatus.FOUND).headers(redirect).build();
    }

    // ── HMAC-SHA512 signature verification ────────────────────────
    private boolean verifySignature(String body, String signature) {
        if (signature == null || signature.isBlank()) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] hash = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString().equals(signature);
        } catch (Exception e) {
            return false;
        }
    }

    // ── Minimal JSON parser (avoid Jackson dependency issues) ──────
    private Map<?, ?> parseJson(String json) throws Exception {
        return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, Map.class);
    }

    // ── Get user ID from auth ─────────────────────────────────────
    private String getUserId(Authentication auth) {
        // We store username in JWT subject — look up the user id
        // For simplicity, order stores customerId as user.id set at order creation
        // Here we return the username and compare via order's customerId field
        return auth.getName(); // handled by orderId ownership check in order creation
    }
}
