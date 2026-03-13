package com.communityalerts.controller;

import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;
import com.communityalerts.service.ExcelImportService;
import com.communityalerts.service.ImportJobStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Admin", description = "Administration and Data Import endpoints")
public class AdminController {

    private final ExcelImportService excelImportService;
    private final IncidentRepository incidentRepository;
    private final SuburbRepository suburbRepository;

    /**
     * Accepts the file, starts the async import, and returns 202 Accepted with
     * a jobId immediately — the browser never has to wait for processing.
     */
    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    @Operation(summary = "Upload SAPS Crime Stats Excel file (async)")
    public ResponseEntity<Map<String, String>> uploadExcel(
            @RequestParam("file") MultipartFile file) throws IOException {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String jobId = excelImportService.startImport(file);
        return ResponseEntity.accepted().body(Map.of("jobId", jobId));
    }

    /**
     * Poll this endpoint every ~2 s to get live import progress. Returns 404 if
     * the jobId is unknown.
     */
    @GetMapping("/upload/status/{jobId}")
    @Operation(summary = "Get import job status")
    public ResponseEntity<ImportJobStatus> getStatus(@PathVariable String jobId) {
        ImportJobStatus status = excelImportService.getJobStatus(jobId);
        if (status == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(status);
    }

    /**
     * Deletes all SAPS-imported incidents and their orphaned suburbs. Safe to
     * call before a re-import to start fresh.
     */
    @DeleteMapping("/imported-data")
    @Transactional
    @Operation(summary = "Clear all SAPS-imported incidents and suburbs")
    public ResponseEntity<Map<String, Object>> clearImportedData() {
        long incidentsBefore = incidentRepository.countByTagsContaining("SAPS");
        incidentRepository.deleteByTagsContaining("SAPS");

        // Remove suburbs that have no remaining incidents
        long suburbsRemoved = suburbRepository.findAll().stream()
                .filter(s -> incidentRepository.findBySuburbIdOrderByCreatedAtDesc(
                s.getId(), org.springframework.data.domain.PageRequest.of(0, 1)).isEmpty())
                .peek(suburbRepository::delete)
                .count();

        log.info("Cleared {} SAPS incidents and {} orphaned suburbs", incidentsBefore, suburbsRemoved);
        return ResponseEntity.ok(Map.of(
                "incidentsDeleted", incidentsBefore,
                "suburbsDeleted", suburbsRemoved
        ));
    }
}
