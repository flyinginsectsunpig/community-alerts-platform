package com.communityalerts.api.messaging;

import com.communityalerts.api.domain.Severity;
import com.communityalerts.api.messaging.events.AlertScoredEvent;
import com.communityalerts.api.service.AlertService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * Applies ML-produced severity scores back onto stored alerts. The payload is
 * parsed explicitly (rather than via converter type headers) because the
 * producer is the Python service, which emits plain JSON.
 */
@Component
public class AlertScoredListener {

    private static final Logger log = LoggerFactory.getLogger(AlertScoredListener.class);

    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    public AlertScoredListener(AlertService alertService, ObjectMapper objectMapper) {
        this.alertService = alertService;
        this.objectMapper = objectMapper;
    }

    @RabbitListener(queues = "${app.amqp.scored-queue}")
    public void onAlertScored(Message message) {
        try {
            AlertScoredEvent event = objectMapper.readValue(message.getBody(), AlertScoredEvent.class);
            alertService.applySeverity(
                    event.alertId(),
                    Severity.valueOf(event.severity()),
                    event.riskScore(),
                    event.modelVersion());
            log.info("Applied severity {} (risk {}) to alert {}",
                    event.severity(), event.riskScore(), event.alertId());
        } catch (Exception e) {
            log.error("Failed to process alert.scored message; dead-lettering", e);
            throw new AmqpRejectAndDontRequeueException("Unprocessable alert.scored message", e);
        }
    }
}
