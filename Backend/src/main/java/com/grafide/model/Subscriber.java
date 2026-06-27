package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;

@Data
@Document(collection = "subscribers")
public class Subscriber {
    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private Instant subscribedAt = Instant.now();
}
