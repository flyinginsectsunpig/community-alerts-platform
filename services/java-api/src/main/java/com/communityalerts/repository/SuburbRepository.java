package com.communityalerts.repository;

import com.communityalerts.model.Suburb;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface SuburbRepository extends JpaRepository<Suburb, String> {

    @Modifying
    @Transactional
    @Query("DELETE FROM Suburb s WHERE NOT EXISTS (SELECT 1 FROM Incident i WHERE i.suburb.id = s.id)")
    void deleteOrphanedSuburbs();
}
