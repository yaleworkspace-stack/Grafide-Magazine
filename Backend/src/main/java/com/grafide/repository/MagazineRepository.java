package com.grafide.repository;

import com.grafide.model.Magazine;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface MagazineRepository extends MongoRepository<Magazine, String> {
    List<Magazine> findAllByOrderByUploadedAtDesc();
}
