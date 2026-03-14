package com.communityalerts.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.communityalerts.model.Suburb;

@Repository
public interface SuburbRepository extends JpaRepository<Suburb, String> {

    @Query("SELECT s.id FROM Suburb s WHERE NOT EXISTS (SELECT 1 FROM Incident i WHERE i.suburb.id = s.id)")
    List<String> findOrphanedSuburbIds();

    @Modifying
    @Transactional
    @Query("DELETE FROM Suburb s WHERE NOT EXISTS (SELECT 1 FROM Incident i WHERE i.suburb.id = s.id)")
    void deleteOrphanedSuburbs();
}
