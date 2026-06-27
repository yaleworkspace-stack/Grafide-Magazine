package com.grafide.repository;

import com.grafide.model.Podcast;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PodcastRepository extends MongoRepository<Podcast, String> {
    Page<Podcast> findAllByOrderByDateDesc(Pageable pageable);
}
