package com.communityalerts.controller;

import java.io.IOException;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.communityalerts.service.ExcelImportService;
import com.communityalerts.service.ImportJobStatus;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Admin", description = "Administration and Data Import endpoints")
public class AdminController {

    private final ExcelImportService excelImportService;

    /**
     * Accepts the file, starts the async import, and returns 202 Accepted
     * with a jobId immediately — the browser never has to wait for processing.
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
     * Poll this endpoint every ~2 s to get live import progress.
     * Returns 404 if the jobId is unknown.
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
     * Deletes all SAPS-imported incidents and their orphaned suburbs.
     * Runs async and returns 202 immediately — deletion of 100k+ rows takes time.
     */
    @DeleteMapping("/imported-data")
    @Operation(summary = "Clear all SAPS-imported incidents and suburbs")
    public ResponseEntity<Map<String, String>> clearImportedData() {
        excelImportService.clearImportedData();
        return ResponseEntity.accepted().body(Map.of("message", "Deletion started — data will be cleared shortly"));
    }
}