package com.grafide.repository;

import com.grafide.model.Subscriber;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface SubscriberRepository extends MongoRepository<Subscriber, String> {
    Optional<Subscriber> findByEmail(String email);
    boolean existsByEmail(String email);
}
