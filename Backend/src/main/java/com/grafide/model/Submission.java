package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "submissions")
public class Submission {
    @Id
    private String id;

    private String title;
    private String dek;
    private String category;
    private String richBody;

    private List<String> coverImageUrls = new ArrayList<>();

    private String authorId;
    private String authorUsername;
    private String authorDisplayName;

    // "pending" | "approved" | "returned" | "withdrawn"
    private String status = "pending";

    private String editorNote;
    private Instant submittedAt  = Instant.now();
    private Instant reviewedAt;
}
