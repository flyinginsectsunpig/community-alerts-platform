package com.communityalerts.repository;

import com.communityalerts.model.ForumPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ForumPostRepository extends JpaRepository<ForumPost, Long> {

    Page<ForumPost> findBySuburbIdOrderByCreatedAtDesc(String suburbId, Pageable pageable);
}
