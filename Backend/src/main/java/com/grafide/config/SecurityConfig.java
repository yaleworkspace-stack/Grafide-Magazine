package com.grafide.config;

import com.grafide.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${grafide.cors.origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth

                // ── Public ──────────────────────────────────────────
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/health").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/articles/**").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/magazines/**").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/podcasts/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/subscribers").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/certificates/verify/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/contact").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/contact").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,  "/api/contact/*/read").hasRole("EDITOR")

                // ── Authenticated (any signed-in user) ──────────────
                .requestMatchers("/api/submissions/mine").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/submissions").authenticated()
                .requestMatchers(HttpMethod.PUT,  "/api/submissions/*/resubmit").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/submissions/*/withdraw").authenticated()

                // ── Editor only ─────────────────────────────────────
                .requestMatchers("/api/submissions/queue").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/submissions/*/approve").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/submissions/*/return").hasRole("EDITOR")
                .requestMatchers(HttpMethod.POST,   "/api/articles/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/articles/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.DELETE, "/api/articles/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.POST,   "/api/magazines").hasRole("EDITOR")
                .requestMatchers(HttpMethod.DELETE, "/api/magazines/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.POST,   "/api/podcasts").hasRole("EDITOR")
                .requestMatchers(HttpMethod.DELETE, "/api/podcasts/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.GET,    "/api/subscribers").hasRole("EDITOR")
                // Image upload: open to any signed-in user (creators need to upload cover images)
                .requestMatchers(HttpMethod.POST,   "/api/upload/image").authenticated()
                // All other upload routes remain editor-only
                .requestMatchers(HttpMethod.POST,   "/api/upload/**").hasRole("EDITOR")

                // ── Shop — public ────────────────────────────────────
                .requestMatchers(HttpMethod.GET,  "/api/shop/products/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/brands/apply").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/paystack/webhook").permitAll()
                .requestMatchers(HttpMethod.GET,  "/api/paystack/callback").permitAll()

                // ── Shop — authenticated customers ────────────────────
                .requestMatchers(HttpMethod.POST, "/api/orders").authenticated()
                .requestMatchers(HttpMethod.GET,  "/api/orders/mine").authenticated()
                .requestMatchers(HttpMethod.GET,  "/api/orders/*").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/paystack/initiate").authenticated()

                // ── Shop — editor only ────────────────────────────────
                .requestMatchers(HttpMethod.POST,   "/api/shop/products").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/shop/products/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.DELETE, "/api/shop/products/**").hasRole("EDITOR")
                .requestMatchers(HttpMethod.GET,    "/api/orders").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/orders/*/status").hasRole("EDITOR")
                .requestMatchers(HttpMethod.GET,    "/api/brands").hasRole("EDITOR")
                .requestMatchers(HttpMethod.GET,    "/api/brands/*").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/brands/*/approve").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/brands/*/reject").hasRole("EDITOR")
                .requestMatchers(HttpMethod.PUT,    "/api/brands/*/commission").hasRole("EDITOR")
                .requestMatchers(HttpMethod.DELETE, "/api/brands/**").hasRole("EDITOR")

                // ── Catch-all ────────────────────────────────────────
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
