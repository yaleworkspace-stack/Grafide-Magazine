package com.grafide.controller;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
public class UploadController {

    private final Optional<Cloudinary> cloudinary;

    @Value("${grafide.storage.mode:local}")
    private String storageMode;

    @Value("${grafide.storage.local-path:uploads/images}")
    private String localPath;

    @Value("${grafide.base-url:http://localhost:8080}")
    private String baseUrl;

    @PostMapping("/image")
    public ResponseEntity<Map<String, String>> uploadImage(
            @RequestParam("file") MultipartFile file) throws IOException {

        if (file.isEmpty()) {
            throw new IllegalArgumentException("No file provided.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Only image files are accepted.");
        }

        if ("cloudinary".equals(storageMode) && cloudinary.isPresent()) {
            try {
                // Use unsigned-style upload with just timestamp — no extra params that break signing
                Map<?, ?> result = cloudinary.get().uploader().upload(
                        file.getBytes(),
                        ObjectUtils.asMap(
                            "folder", "grafide"
                        )
                );
                String url = (String) result.get("secure_url");
                if (url == null) {
                    throw new RuntimeException("Cloudinary returned no URL. Check CLOUDINARY_URL env var.");
                }
                return ResponseEntity.ok(Map.of("url", url));
            } catch (Exception e) {
                // Log full error to Render logs
                System.err.println("[Grafide Upload] Cloudinary error: " + e.getMessage());
                e.printStackTrace();
                throw new RuntimeException("Image upload failed: " + e.getMessage());
            }
        } else {
            // Local disk
            String ext      = getExtension(file.getOriginalFilename());
            String filename = UUID.randomUUID() + "." + ext;
            Path dir        = Paths.get(localPath);
            Files.createDirectories(dir);
            Files.copy(file.getInputStream(), dir.resolve(filename),
                    StandardCopyOption.REPLACE_EXISTING);
            String url = baseUrl + "/" + localPath + "/" + filename;
            return ResponseEntity.ok(Map.of("url", url));
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "jpg";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
