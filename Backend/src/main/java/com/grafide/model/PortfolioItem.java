package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "portfolio")
public class PortfolioItem {
    @Id
    private String id;

    private String title;
    private String category;   // "Editorial" | "Photography" | "Design" | "Campaign"
    private String client;
    private String description;
    private List<String> imageUrls = new ArrayList<>();
    private String coverUrl;
    private boolean featured = false;
    private int    sortOrder = 0;
    private Instant createdAt = Instant.now();
}
