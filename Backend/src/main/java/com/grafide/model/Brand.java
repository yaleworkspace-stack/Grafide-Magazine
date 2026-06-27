package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;

@Data
@Document(collection = "brands")
public class Brand {
    @Id
    private String id;

    private String name;
    private String email;
    private String website;
    private String instagram;
    private String description;
    private String contactName;

    // "pending" | "approved" | "rejected"
    private String status = "pending";

    private double commissionRate = 15.0; // % set by editor on approval
    private String editorNote;

    private Instant appliedAt  = Instant.now();
    private Instant reviewedAt;
}
