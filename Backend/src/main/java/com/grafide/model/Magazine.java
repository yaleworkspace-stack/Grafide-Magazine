package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "magazines")
public class Magazine {
    @Id
    private String id;

    private String title;
    private String dek;
    private String richBody;
    private List<String> coverImageUrls = new ArrayList<>();
    private Instant uploadedAt = Instant.now();
}
