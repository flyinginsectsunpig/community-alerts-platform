package com.communityalerts.service;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.eventusermodel.XSSFReader;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler.SheetContentsHandler;
import org.apache.poi.xssf.model.SharedStrings;
import org.apache.poi.xssf.model.StylesTable;
import org.apache.poi.xssf.usermodel.XSSFComment;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.ContentHandler;
import org.xml.sax.InputSource;
import org.xml.sax.XMLReader;
import org.xml.sax.helpers.XMLReaderFactory;

import com.communityalerts.model.Incident;
import com.communityalerts.model.IncidentType;
import com.communityalerts.model.Suburb;
import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Optimised Excel import pipeline for SAPS crime stats.
 *
 * Key improvements over the original: 1. Streaming read via XSSFWorkbook opened
 * from InputStream — avoids loading the entire workbook DOM into heap at once.
 * 2. Suburb pre-cache — all existing suburbs loaded once before the loop
 * instead of two DB round-trips per row. 3. Batch inserts — incidents collected
 * in a list and flushed every BATCH_SIZE rows using saveAll(), relying on
 * Hibernate JDBC batching. 4. Async execution — the public entry-point is
 * @Async and returns immediately. Progress is tracked via a job-status map. 5.
 * Heat score recalculation deferred to the very end of the async job.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private static final int BATCH_SIZE = 500;
    private static final String JOB_KEY_PREFIX = "import-job:";
    private static final Duration JOB_TTL = Duration.ofHours(2);



    private final IncidentRepository incidentRepository;
    private final SuburbRepository suburbRepository;
    private final HeatScoreService heatScoreService;
    private final RedisTemplate<String, ImportJobStatus> importJobRedisTemplate;

    @Autowired
    @Lazy
    private ExcelImportService self;



    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    /**
     * Creates a job entry and returns the job ID immediately. Actual processing
     * happens asynchronously in {@link #runImport}.
     */
    public String startImport(MultipartFile file) throws IOException {
        String jobId = UUID.randomUUID().toString();
        ImportJobStatus status = new ImportJobStatus(jobId);
        importJobRedisTemplate.opsForValue().set(JOB_KEY_PREFIX + jobId, status, JOB_TTL);

        byte[] bytes = file.getBytes();
        self.runImport(jobId, bytes);
        return jobId;
    }

    /**
     * Returns the current status of a previously started import job.
     */
    public ImportJobStatus getJobStatus(String jobId) {
        return importJobRedisTemplate.opsForValue().get(JOB_KEY_PREFIX + jobId);
    }

    /**
     * Deletes all SAPS-imported incidents and their orphaned suburbs.
     * Starts an async process and returns immediately.
     */
    public void clearImportedData() {
        log.info("Request to clear all imported data received");
        self.runDataClear();
    }

    /**
     * Async worker that performs the deletion of SAPS-imported data.
     */
    @Async
    @Transactional
    public void runDataClear() {
        log.info("Starting async data clear...");
        try {
            // 1. Delete all incidents tagged with SAPS
            incidentRepository.deleteCommentsByIncidentTag("SAPS");
            incidentRepository.bulkDeleteByTagsContaining("SAPS");
            log.info("Deleted SAPS-imported incidents.");

            // 2. Clear orphaned suburbs (those with no incidents)
            suburbRepository.deleteOrphanedSuburbs();
            log.info("Cleared orphaned suburbs.");

            // 3. Recalculate heat scores to reflect the cleared data
            heatScoreService.recalculateAll();
            log.info("Data clear and heat score recalculation complete.");
        } catch (Exception e) {
            log.error("Failed to clear imported data", e);
        }
    }

    // ------------------------------------------------------------------
    // Async worker
    // ------------------------------------------------------------------
    @Async
    public void runImport(String jobId, byte[] fileBytes) {
        ImportJobStatus jobStatus = importJobRedisTemplate.opsForValue().get(JOB_KEY_PREFIX + jobId);
        if (jobStatus == null) {
            log.error("[job={}] Job not found in Redis at start of runImport", jobId);
            return;
        }
        jobStatus.setStatus(ImportJobStatus.Status.RUNNING);
        saveJob(jobStatus);

        try (OPCPackage pkg = OPCPackage.open(new java.io.ByteArrayInputStream(fileBytes))) {

            XSSFReader reader = new XSSFReader(pkg);
            SharedStrings sst = reader.getSharedStringsTable();
            StylesTable styles = reader.getStylesTable();

            // ── Detect sheet & layout ────────────────────────────────────
            // SAPS workbooks use a sheet named "RAW Data"; fall back to sheet 0.
            boolean isSaps = false;
            String targetSheetName = null;
            XSSFReader.SheetIterator it = (XSSFReader.SheetIterator) reader.getSheetsData();
            while (it.hasNext()) {
                try (InputStream s = it.next()) {
                    /* just iterate */ }
                String name = it.getSheetName();
                if ("RAW Data".equalsIgnoreCase(name)) {
                    isSaps = true;
                    targetSheetName = name;
                    break;
                }
                if (targetSheetName == null) {
                    targetSheetName = name; // fallback = first sheet

                            }}
            final boolean saps = isSaps;
            // SAPS: headers row 3 (0-based=2), data from row 4 (0-based=3)
            // station=col 4 (E), offence=col 7 (H), count=col 28 (AC)
            final int dataStartRow = saps ? 3 : 1;
            final int stationCol = saps ? 4 : 3;
            final int offenceCol = saps ? 7 : 0;
            final int countCol = saps ? 28 : -1; // -1 = no count column

            // ── Pass 1: stream sheet once to discover unique stations ────
            Map<String, Suburb> suburbCache = new HashMap<>();
            suburbRepository.findAll().forEach(s -> suburbCache.put(s.getId(), s));

            Set<String> newStationNames = new HashSet<>();

            streamSheet(reader, sst, styles, targetSheetName, new SheetContentsHandler() {
                private int currentRow = -1;
                private final Map<Integer, String> rowData = new HashMap<>();

                @Override
                public void startRow(int rowNum) {
                    currentRow = rowNum;
                    rowData.clear();
                }

                @Override
                public void cell(String cellRef, String formattedValue, XSSFComment comment) {
                    if (formattedValue == null || formattedValue.isBlank()) {
                        return;
                    }
                    int col = new CellReference(cellRef).getCol();
                    rowData.put(col, formattedValue.trim());
                }

                @Override
                public void endRow(int rowNum) {
                    if (currentRow < dataStartRow) {
                        return;
                    }
                    String station = rowData.get(stationCol);
                    if (station == null || station.isBlank()) {
                        return;
                    }
                    String sid = toSuburbId(station);
                    if (!suburbCache.containsKey(sid)) {
                        newStationNames.add(station);
                    }
                }

                @Override
                public void headerFooter(String text, boolean isHeader, String tagName) {
                }
            });

            // Persist new suburbs
            if (!newStationNames.isEmpty()) {
                List<Suburb> toSave = new ArrayList<>();
                for (String name : newStationNames) {
                    // Nominatim rate limit: 1 request per second (their usage policy)
                    Thread.sleep(1100);
                    double[] coords = geocodeStation(name);
                    toSave.add(Suburb.builder()
                            .id(toSuburbId(name))
                            .name(name)
                            .latitude(coords[0])
                            .longitude(coords[1])
                            .build());
                }
                suburbRepository.saveAll(toSave).forEach(s -> suburbCache.put(s.getId(), s));
                jobStatus.setSuburbsAdded(toSave.size());
                log.info("[job={}] Persisted {} new suburbs", jobId, toSave.size());
                saveJob(jobStatus);
            }

            // ── Pass 2: stream sheet again, build & batch-insert incidents
            List<Incident> batch = new ArrayList<>(BATCH_SIZE);
            // Use array to allow mutation inside lambda
            int[] rowsProcessed = {0};
            int[] incidentsAdded = {0};

            streamSheet(reader, sst, styles, targetSheetName, new SheetContentsHandler() {
                private int currentRow = -1;
                private final Map<Integer, String> rowData = new HashMap<>();

                @Override
                public void startRow(int rowNum) {
                    currentRow = rowNum;
                    rowData.clear();
                }

                @Override
                public void cell(String cellRef, String formattedValue, XSSFComment comment) {
                    if (formattedValue == null || formattedValue.isBlank()) {
                        return;
                    }
                    int col = new CellReference(cellRef).getCol();
                    rowData.put(col, formattedValue.trim());
                }

                @Override
                public void endRow(int rowNum) {
                    if (currentRow < dataStartRow) {
                        return;
                    }

                    String station = rowData.get(stationCol);
                    String offence = rowData.get(offenceCol);
                    if (station == null || offence == null || station.isBlank() || offence.isBlank()) {
                        return;
                    }

                    Suburb suburb = suburbCache.get(toSuburbId(station));
                    if (suburb == null) {
                        return;
                    }

                    int count = 1;
                    if (countCol >= 0) {
                        String countStr = rowData.get(countCol);
                        if (countStr != null) {
                            try {
                                count = Math.max(0, (int) Double.parseDouble(countStr));
                            } catch (NumberFormatException ignored) {
                                count = 0;
                            }
                        }
                        if (count <= 0) {
                            return;
                        }
                    }

                    String suffix = countCol < 0 ? "" : " (quarter count: " + count + ")";
                    IncidentType type = IncidentTypeClassifier.classifyType(offence);
                    batch.add(Incident.builder()
                            .suburb(suburb)
                            .type(type)
                            .severity(IncidentTypeClassifier.defaultSeverity(type))
                            .title("Reported: " + offence + suffix)
                            .description("Imported from SAPS Crime Stats: " + offence + " at " + station + suffix)
                            .tags("Imported,SAPS")
                            .latitude(suburb.getLatitude())
                            .longitude(suburb.getLongitude())
                            .build());

                    rowsProcessed[0]++;

                    if (batch.size() >= BATCH_SIZE) {
                        incidentRepository.saveAll(batch);
                        incidentsAdded[0] += batch.size();
                        jobStatus.setIncidentsAdded(incidentsAdded[0]);
                        jobStatus.setRowsProcessed(rowsProcessed[0]);
                        log.debug("[job={}] Flushed batch (total incidents: {})", jobId, incidentsAdded[0]);
                        batch.clear();
                        // Persist progress to Redis every ~5k rows to avoid hammering it on every batch
                        if (rowsProcessed[0] % 5000 < BATCH_SIZE) {
                            saveJob(jobStatus);
                        }
                    }
                }

                @Override
                public void headerFooter(String text, boolean isHeader, String tagName) {
                }
            });

            // Flush remainder
            if (!batch.isEmpty()) {
                incidentRepository.saveAll(batch);
                incidentsAdded[0] += batch.size();
                batch.clear();
            }

            jobStatus.setRowsProcessed(rowsProcessed[0]);
            jobStatus.setIncidentsAdded(incidentsAdded[0]);
            jobStatus.setStatus(ImportJobStatus.Status.FINALIZING);
            saveJob(jobStatus);

            // Heat score recalculation runs in a separate try-catch so a timeout
            // or RabbitMQ hiccup never rolls back a fully successful import.
            // With 1,200+ suburbs each triggering a RabbitMQ publish this can be
            // slow; mark the job DONE first, then recalculate in the background.
            jobStatus.setStatus(ImportJobStatus.Status.DONE);
            saveJob(jobStatus);
            log.info("[job={}] Import complete — rows={} incidents={} suburbs={}",
                    jobId, rowsProcessed[0], incidentsAdded[0], jobStatus.getSuburbsAdded());

            try {
                log.info("[job={}] Starting background heat score recalculation", jobId);
                heatScoreService.recalculateAll();
                log.info("[job={}] Heat score recalculation complete", jobId);
            } catch (Exception heatEx) {
                // Non-fatal: data is already committed. Scores will catch up on
                // the next recalculation triggered by an incident submission.
                log.warn("[job={}] Heat score recalculation failed (non-fatal): {}", jobId, heatEx.getMessage());
            }

        } catch (Exception e) {
            log.error("[job={}] Import failed", jobId, e);
            ImportJobStatus js = importJobRedisTemplate.opsForValue().get(JOB_KEY_PREFIX + jobId);
            if (js != null) {
                js.setStatus(ImportJobStatus.Status.ERROR);
                js.setErrorMessage(e.getMessage());
                saveJob(js);
            }
        }
    }

    /**
     * Streams a single named sheet through a SAX handler. Falls back to sheet
     * index 0 if the name is not found.
     */
    @SuppressWarnings("deprecation")
    private void streamSheet(XSSFReader reader, SharedStrings sst, StylesTable styles,
            String sheetName, SheetContentsHandler handler) throws Exception {

        ContentHandler xmlHandler = new XSSFSheetXMLHandler(styles, null, sst, handler, new org.apache.poi.ss.usermodel.DataFormatter(), false);
        XMLReader parser = XMLReaderFactory.createXMLReader();
        parser.setContentHandler(xmlHandler);

        XSSFReader.SheetIterator it = (XSSFReader.SheetIterator) reader.getSheetsData();
        InputStream target = null;
        InputStream first = null;

        while (it.hasNext()) {
            InputStream s = it.next();
            if (first == null) {
                first = s;
            }
            if (it.getSheetName().equalsIgnoreCase(sheetName)) {
                target = s;
                break;
            }
        }

        try (InputStream sheet = target != null ? target : first) {
            if (sheet == null) {
                throw new IllegalStateException("No sheets found in workbook");
            }
            parser.parse(new InputSource(sheet));
        }
    }

    private void saveJob(ImportJobStatus jobStatus) {
        importJobRedisTemplate.opsForValue().set(
                JOB_KEY_PREFIX + jobStatus.getJobId(), jobStatus, JOB_TTL);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    private double[] geocodeStation(String stationName) {
        try {
            String query = URLEncoder.encode(stationName + ", Cape Town, South Africa", StandardCharsets.UTF_8);
            URI uri = URI.create("https://nominatim.openstreetmap.org/search?q=" + query + "&format=json&limit=1");
            
            HttpRequest request = HttpRequest.newBuilder(uri)
                .header("User-Agent", "CommunityAlertsPlatform/1.0")  // Nominatim requires a User-Agent
                .GET()
                .build();
            
            HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());
            
            JsonNode results = new ObjectMapper().readTree(response.body());
            if (results.isArray() && results.size() > 0) {
                double lat = results.get(0).get("lat").asDouble();
                double lon = results.get(0).get("lon").asDouble();
                return new double[]{lat, lon};
            }
        } catch (Exception e) {
            log.warn("Geocoding failed for station '{}': {}", stationName, e.getMessage());
        }
        return new double[]{-33.9249, 18.4241};  // fallback only if geocoding fails
    }

    private static String toSuburbId(String stationStr) {
        return stationStr.toLowerCase().replaceAll("[^a-z0-9]", "-");
    }
}
