package com.grafide.repository;

import com.grafide.model.ContactMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ContactRepository extends MongoRepository<ContactMessage, String> {
    List<ContactMessage> findByReadFalseOrderByReceivedAtDesc();
    List<ContactMessage> findAllByOrderByReceivedAtDesc();
}
