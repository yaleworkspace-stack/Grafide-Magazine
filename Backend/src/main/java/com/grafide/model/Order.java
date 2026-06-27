package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "orders")
public class Order {
    @Id
    private String id;

    // Customer
    private String customerId;
    private String customerName;
    private String customerEmail;

    // Items
    private List<OrderItem> items = new ArrayList<>();

    // Totals (all in Naira)
    private double subtotal;
    private double shippingFee;
    private double total;

    // Shipping address
    private String shippingName;
    private String shippingPhone;
    private String shippingAddress;
    private String shippingCity;
    private String shippingState;

    // Paystack
    private String paystackReference;
    private String paystackAuthUrl;

    // "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
    private String status = "PENDING";

    private Instant createdAt  = Instant.now();
    private Instant paidAt;
    private Instant shippedAt;
    private Instant deliveredAt;
}
