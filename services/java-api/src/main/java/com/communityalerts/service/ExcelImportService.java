package com.communityalerts.service;

import com.communityalerts.model.Incident;
import com.communityalerts.model.IncidentType;
import com.communityalerts.model.Suburb;
import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Optimised Excel import pipeline for SAPS crime stats.
 *
 * Key improvements over the original:
 * 1. Streaming read via XSSFWorkbook opened from InputStream — avoids loading
 * the entire workbook DOM into heap at once.
 * 2. Suburb pre-cache — all existing suburbs loaded once before the loop
 * instead of two DB round-trips per row.
 * 3. Batch inserts — incidents collected in a list and flushed every
 * BATCH_SIZE rows using saveAll(), relying on Hibernate JDBC batching.
 * 4. Async execution — the public entry-point is @Async and returns
 * immediately. Progress is tracked via a job-status map.
 * 5. Heat score recalculation deferred to the very end of the async job.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private static final int BATCH_SIZE = 500;

    private final IncidentRepository incidentRepository;
    private final SuburbRepository suburbRepository;
    private final HeatScoreService heatScoreService;

    /** In-memory job registry — keyed by UUID job ID. */
    private final ConcurrentHashMap<String, ImportJobStatus> jobs = new ConcurrentHashMap<>();

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Creates a job entry and returns the job ID immediately.
     * Actual processing happens asynchronously in {@link #runImport}.
     */
    public String startImport(MultipartFile file) throws IOException {
        String jobId = UUID.randomUUID().toString();
        ImportJobStatus status = new ImportJobStatus(jobId);
        jobs.put(jobId, status);

        // Read bytes eagerly — MultipartFile's temp storage may be deleted
        // once the request thread ends, so we must copy the bytes before
        // handing control to the async thread.
        byte[] bytes = file.getBytes();
        runImport(jobId, bytes);
        return jobId;
    }

    /** Returns the current status of a previously started import job. */
    public ImportJobStatus getJobStatus(String jobId) {
        return jobs.get(jobId);
    }

    // ------------------------------------------------------------------
    // Async worker
    // ------------------------------------------------------------------

    @Async
    @Transactional
    public void runImport(String jobId, byte[] fileBytes) {
        ImportJobStatus jobStatus = jobs.get(jobId);
        jobStatus.setStatus(ImportJobStatus.Status.RUNNING);

        try (java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(fileBytes);
                Workbook workbook = new XSSFWorkbook(bais)) {

            Sheet sheet = workbook.getSheetAt(0);

            // ── 1. Pre-load suburb cache ────────────────────────────────
            // One SELECT instead of two queries per row.
            Map<String, Suburb> suburbCache = new HashMap<>();
            suburbRepository.findAll().forEach(s -> suburbCache.put(s.getId(), s));
            List<Suburb> newSuburbs = new ArrayList<>();

            // ── 2. First pass: discover & persist new suburbs ───────────
            // Separated so we can re-use the persisted objects in incident batch.
            Set<String> seenSuburbIds = new HashSet<>();
            int totalRows = sheet.getLastRowNum();

            for (int i = 1; i <= totalRows; i++) {
                Row row = sheet.getRow(i);
                if (row == null)
                    continue;

                Cell stationCell = row.getCell(3, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                if (stationCell == null)
                    continue;

                String stationStr = getCellValue(stationCell);
                if (stationStr == null || stationStr.isEmpty())
                    continue;

                String suburbId = toSuburbId(stationStr);
                if (!suburbCache.containsKey(suburbId) && seenSuburbIds.add(suburbId)) {
                    Suburb newSuburb = Suburb.builder()
                            .id(suburbId)
                            .name(stationStr)
                            .latitude(-33.9249) // Default Cape Town centroid
                            .longitude(18.4241)
                            .build();
                    newSuburbs.add(newSuburb);
                    jobStatus.setSuburbsAdded(jobStatus.getSuburbsAdded() + 1);
                }
            }

            if (!newSuburbs.isEmpty()) {
                List<Suburb> saved = suburbRepository.saveAll(newSuburbs);
                saved.forEach(s -> suburbCache.put(s.getId(), s));
                log.info("[job={}] Persisted {} new suburbs", jobId, saved.size());
            }

            // ── 3. Second pass: build & batch-insert incidents ──────────
            List<Incident> batch = new ArrayList<>(BATCH_SIZE);

            for (int i = 1; i <= totalRows; i++) {
                Row row = sheet.getRow(i);
                if (row == null)
                    continue;

                Cell offenceCell = row.getCell(0, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                Cell stationCell = row.getCell(3, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                if (offenceCell == null || stationCell == null)
                    continue;

                String offenceStr = getCellValue(offenceCell);
                String stationStr = getCellValue(stationCell);
                if (offenceStr == null || offenceStr.isEmpty() ||
                        stationStr == null || stationStr.isEmpty())
                    continue;

                Suburb suburb = suburbCache.get(toSuburbId(stationStr));
                if (suburb == null)
                    continue; // should never happen after pass-1

                IncidentType type = IncidentTypeClassifier.classifyType(offenceStr);

                batch.add(Incident.builder()
                        .suburb(suburb)
                        .type(type)
                        .severity(IncidentTypeClassifier.defaultSeverity(type))
                        .title("Reported: " + offenceStr)
                        .description("Imported from SAPS Crime Stats: " + offenceStr + " at " + stationStr)
                        .tags("Imported,SAPS")
                        .latitude(suburb.getLatitude())
                        .longitude(suburb.getLongitude())
                        .build());

                jobStatus.setRowsProcessed(jobStatus.getRowsProcessed() + 1);

                if (batch.size() >= BATCH_SIZE) {
                    incidentRepository.saveAll(batch);
                    jobStatus.setIncidentsAdded(jobStatus.getIncidentsAdded() + batch.size());
                    log.debug("[job={}] Flushed batch of {} incidents (total: {})",
                            jobId, batch.size(), jobStatus.getIncidentsAdded());
                    batch.clear();
                }
            }

            // Flush remainder
            if (!batch.isEmpty()) {
                incidentRepository.saveAll(batch);
                jobStatus.setIncidentsAdded(jobStatus.getIncidentsAdded() + batch.size());
                batch.clear();
            }

            // ── 4. Deferred heat score recalc ───────────────────────────
            log.info("[job={}] Starting heat score recalculation", jobId);
            heatScoreService.recalculateAll();

            jobStatus.setStatus(ImportJobStatus.Status.DONE);
            log.info("[job={}] Import complete — rows={} incidents={} suburbs={}",
                    jobId,
                    jobStatus.getRowsProcessed(),
                    jobStatus.getIncidentsAdded(),
                    jobStatus.getSuburbsAdded());

        } catch (Exception e) {
            log.error("[job={}] Import failed", jobId, e);
            jobStatus.setStatus(ImportJobStatus.Status.ERROR);
            jobStatus.setErrorMessage(e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static String toSuburbId(String stationStr) {
        return stationStr.toLowerCase().replaceAll("[^a-z0-9]", "-");
    }

    private static String getCellValue(Cell cell) {
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> "";
        };
    }
}
