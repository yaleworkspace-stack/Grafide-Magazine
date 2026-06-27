package com.grafide.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;

@Data
@Document(collection = "users")
public class User {
    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    @Indexed(unique = true)
    private String email;

    private String password;          // bcrypt hashed
    private String displayName;
    private String role = "creator";  // "creator" | "editor"
    private Instant createdAt = Instant.now();

    // Password reset
    private String resetToken;
    private Instant resetTokenExpiry;
}
