package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Data
@Document(collection = "podcasts")
public class Podcast {
    @Id
    private String id;

    private String title;
    private String dek;
    private String embedUrl;
    private String body;
    private Instant date = Instant.now();
}
