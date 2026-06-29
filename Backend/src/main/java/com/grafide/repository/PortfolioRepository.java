package com.grafide.repository;

import com.grafide.model.PortfolioItem;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface PortfolioRepository extends MongoRepository<PortfolioItem, String> {
    List<PortfolioItem> findAllByOrderBySortOrderAscCreatedAtDesc();
    List<PortfolioItem> findByCategoryOrderBySortOrderAsc(String category);
    List<PortfolioItem> findByFeaturedTrueOrderBySortOrderAsc();
}
