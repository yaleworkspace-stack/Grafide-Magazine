package com.grafide.repository;

import com.grafide.model.Submission;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface SubmissionRepository extends MongoRepository<Submission, String> {
    List<Submission> findByAuthorIdOrderBySubmittedAtDesc(String authorId);
    List<Submission> findByStatusOrderBySubmittedAtAsc(String status);
}
