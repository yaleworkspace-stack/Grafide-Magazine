package com.grafide.repository;

import com.grafide.model.Article;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface ArticleRepository extends MongoRepository<Article, String> {
    Page<Article> findByPublishedTrueOrderByPinnedDescDateDesc(Pageable pageable);
    Page<Article> findByCategoryAndPublishedTrueOrderByDateDesc(String category, Pageable pageable);

    @Query("{ 'published': true, $or: [ " +
           "{ 'title':    { $regex: ?0, $options: 'i' } }, " +
           "{ 'dek':      { $regex: ?0, $options: 'i' } }, " +
           "{ 'author':   { $regex: ?0, $options: 'i' } }, " +
           "{ 'category': { $regex: ?0, $options: 'i' } } ] }")
    java.util.List<Article> searchPublished(String query);
}
