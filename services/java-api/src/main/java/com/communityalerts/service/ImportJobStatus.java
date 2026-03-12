package com.communityalerts.service;

import lombok.Data;
import java.io.Serializable;

/**
 * Tracks the progress of an async Excel import job.
 * Stored in Redis so all container replicas share the same state.
 * Fields are updated by the background thread and polled by the controller.
 */
@Data
public class ImportJobStatus implements Serializable {

    private static final long serialVersionUID = 1L;

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
