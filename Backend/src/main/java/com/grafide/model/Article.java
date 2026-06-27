package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "articles")
public class Article {
    @Id
    private String id;

    private String title;
    private String dek;

    @Indexed
    private String category;

    private String author;
    private String authorId;
    private String richBody;

    private List<String> coverImageUrls = new ArrayList<>();

    private boolean pinned     = false;
    private boolean published  = true;
    private Instant date       = Instant.now();
}
