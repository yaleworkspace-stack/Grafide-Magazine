package com.grafide;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import jakarta.annotation.PostConstruct;

@SpringBootApplication
public class GrafideApplication {

    @Value("${grafide.jwt.secret}")
    private String jwtSecret;

    /**
     * Hard fail on startup if the JWT secret looks like the dev placeholder.
     * Prevents weak secrets from accidentally reaching production.
     */
    @PostConstruct
    public void validateConfig() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                "FATAL: grafide.jwt.secret is not set. " +
                "Set the JWT_SECRET environment variable before starting."
            );
        }
        if (jwtSecret.contains("local-dev") || jwtSecret.length() < 32) {
            String profile = System.getProperty("spring.profiles.active", "");
            if (profile.contains("prod")) {
                throw new IllegalStateException(
                    "FATAL: Weak or dev JWT secret detected in production profile. " +
                    "Set a strong JWT_SECRET (32+ chars) in the Render environment."
                );
            }
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(GrafideApplication.class, args);
    }
}
