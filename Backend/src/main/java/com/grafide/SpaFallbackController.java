package com.grafide;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaFallbackController {

    // Forward any non-API, non-file route to index.html
    @GetMapping(value = {
        "/article/**",
        "/category/**",
        "/podcast/**",
        "/magazines/**"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}