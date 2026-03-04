package com.communityalerts.controller;

import com.communityalerts.service.ExcelImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Administration and Data Import endpoints")
public class AdminController {

    private final ExcelImportService excelImportService;

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    @Operation(summary = "Upload SAPS Crime Stats Excel file")
    public ResponseEntity<Map<String, Integer>> uploadExcel(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Map<String, Integer> result = excelImportService.importIncidents(file);
        return ResponseEntity.ok(result);
    }
}
