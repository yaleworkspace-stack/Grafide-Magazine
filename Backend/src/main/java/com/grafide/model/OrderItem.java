package com.grafide.model;

import lombok.Data;

@Data
public class OrderItem {
    private String productId;
    private String productTitle;
    private String imageUrl;
    private double unitPrice;
    private int    quantity;
    private double subtotal;

    // For commission calculation at time of order
    private String brandId;
    private String brandName;
    private double commissionRate;  // % Grafide keeps
    private double commissionAmount;
    private double brandPayout;
}
