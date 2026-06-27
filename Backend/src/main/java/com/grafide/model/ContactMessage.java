package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Data
@Document(collection = "contact_messages")
public class ContactMessage {
    @Id
    private String id;

    private String name;
    private String email;
    private String subject;
    private String message;
    private boolean read = false;
    private Instant receivedAt = Instant.now();
}
