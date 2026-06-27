package com.grafide.repository;

import com.grafide.model.Brand;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface BrandRepository extends MongoRepository<Brand, String> {
    List<Brand> findByStatusOrderByAppliedAtDesc(String status);
    List<Brand> findAllByOrderByAppliedAtDesc();
    boolean existsByEmail(String email);
}
