package com.communityalerts.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.communityalerts.model.ForumPost;

@Repository
public interface ForumPostRepository extends JpaRepository<ForumPost, Long> {

    Page<ForumPost> findBySuburbIdOrderByCreatedAtDesc(String suburbId, Pageable pageable);

    @Modifying
    @Transactional
    @Query("DELETE FROM ForumPost fp WHERE fp.suburb.id IN :suburbIds")
    void deleteBySuburbIdIn(@Param("suburbIds") List<String> suburbIds);
}
