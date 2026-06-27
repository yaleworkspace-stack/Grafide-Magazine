package com.grafide.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CloudinaryConfig {

    /**
     * Only instantiated when grafide.storage.mode=cloudinary (prod profile).
     * Local profile sets mode=local so Cloudinary is never required locally.
     */
    @Bean
    @ConditionalOnProperty(name = "grafide.storage.mode", havingValue = "cloudinary")
    public Cloudinary cloudinary(@Value("${cloudinary.url}") String cloudinaryUrl) {
        return new Cloudinary(cloudinaryUrl);
    }
}
