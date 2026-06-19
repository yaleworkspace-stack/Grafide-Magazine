package com.grafide;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Forwards client-side SPA routes to index.html so that a browser
 * refresh on /article/123 or /category/Fashion doesn't 404.
 *
 * Active only under the "local" profile (native Windows dev), where
 * Spring itself serves the Frontend/ directory as static content.
 *
 * In the "prod" profile the frontend is a Render Static Site and
 * SPA fallback is handled by a Render _redirects rule — this
 * controller must be inactive so Spring does not intercept routes
 * that should never reach the backend container.
 */
@Profile("local")
@Controller
public class SpaFallbackController {

    @GetMapping("/")
    public String home() {
        return "forward:/index.html";
    }

    @GetMapping(value = {
        "/article/**",
        "/category/**",
        "/podcast/**",
        "/magazines/**",
        "/submit",
        "/mine",
        "/review",
        "/manage",
        "/subscribers",
        "/auth",
        "/search",
        "/forgot-password",
        "/reset-password"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}