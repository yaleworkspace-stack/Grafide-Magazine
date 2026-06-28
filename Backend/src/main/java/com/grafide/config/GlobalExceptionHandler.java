package com.grafide.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;
import java.util.logging.Logger;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = Logger.getLogger(GlobalExceptionHandler.class.getName());

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException ex) {
        // These are expected validation errors — return message directly to client
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(AccessDeniedException ex) {
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", "You do not have permission to perform this action."));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleFileTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity
                .status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("message", "File is too large. Maximum size is 20 MB."));
    }

    /**
     * Catch-all — log the FULL stack trace so Render logs show the real cause.
     * Returns the actual exception message to the client instead of hiding it.
     * Once the root cause is confirmed stable, you can revert to a generic message.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneric(Exception ex) {
        // Print full stack trace to Render logs — visible under "Logs" in the dashboard
        log.severe("[Grafide] Unhandled exception: " + ex.getClass().getName()
                + " — " + ex.getMessage());
        ex.printStackTrace();

        // Return the real message temporarily so you can diagnose from the frontend too
        String clientMessage = ex.getMessage() != null
                ? ex.getMessage()
                : "An unexpected error occurred. Please try again.";

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                        "message", clientMessage,
                        "type",    ex.getClass().getSimpleName()
                ));
    }
}
