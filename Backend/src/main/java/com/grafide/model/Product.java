package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "products")
public class Product {
    @Id
    private String id;

    private String title;
    private String description;
    private String category;       // "Magazine Issues" | "Apparel" | "Accessories" | "Beauty"

    private double price;          // in kobo? No — store in Naira, convert to kobo for Paystack
    private int    stock;
    private boolean outOfStock = false;

    private List<String> imageUrls = new ArrayList<>();

    // Ownership
    private String  ownerId;       // null = Grafide's own product
    private String  ownerName;     // "Grafide" or brand name
    private String  brandId;       // null for Grafide products
    private double  commissionRate; // brand's commission rate at time of listing

    private boolean published = true;
    private Instant createdAt = Instant.now();
}
