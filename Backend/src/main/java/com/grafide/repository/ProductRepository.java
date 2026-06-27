package com.grafide.repository;

import com.grafide.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.util.List;

public interface ProductRepository extends MongoRepository<Product, String> {
    Page<Product> findByPublishedTrueOrderByCreatedAtDesc(Pageable pageable);
    Page<Product> findByCategoryAndPublishedTrueOrderByCreatedAtDesc(String category, Pageable pageable);
    List<Product> findByBrandIdAndPublishedTrue(String brandId);

    @Query("{ 'published': true, $or: [ " +
           "{ 'title':       { $regex: ?0, $options: 'i' } }, " +
           "{ 'description': { $regex: ?0, $options: 'i' } }, " +
           "{ 'ownerName':   { $regex: ?0, $options: 'i' } }, " +
           "{ 'category':    { $regex: ?0, $options: 'i' } } ] }")
    List<Product> searchPublished(String query);
}
