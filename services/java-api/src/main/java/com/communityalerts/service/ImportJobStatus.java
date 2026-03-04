package com.communityalerts.service;

import lombok.Data;

/**
 * Tracks the progress of an async Excel import job.
 * Stored in-memory (ConcurrentHashMap in ExcelImportService).
 * Fields are updated by the background thread and polled by the controller.
 */
@Data
public class ImportJobStatus {

    public enum Status {
        QUEUED, RUNNING, FINALIZING, DONE, ERROR
    }

    private final String jobId;
    private volatile Status status = Status.QUEUED;
    private volatile int rowsProcessed = 0;
    private volatile int incidentsAdded = 0;
    private volatile int suburbsAdded = 0;
    private volatile String errorMessage = null;

    public ImportJobStatus(String jobId) {
        this.jobId = jobId;
    }
}
