package com.grafide;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import jakarta.annotation.PostConstruct;

// Exclude the auto-configured UserDetailsService — we use JWT only.
// Without this exclusion Spring Boot generates a random password on startup
// and its BasicAuthenticationFilter can intercept requests before our JwtAuthFilter.
@SpringBootApplication(exclude = { UserDetailsServiceAutoConfiguration.class })
public class GrafideApplication {

    @Value("${grafide.jwt.secret}")
    private String jwtSecret;

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
