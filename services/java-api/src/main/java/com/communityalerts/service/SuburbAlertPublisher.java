package com.communityalerts.service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.communityalerts.config.RabbitMQConfig;

import lombok.extern.slf4j.Slf4j;

/**
 * Publishes suburb alert events to RabbitMQ when an alert level
 * escalates past a threshold (typically to RED).
 *
 * The .NET Notification service consumes these messages for
 * guaranteed delivery — no more relying on HTTP webhooks.
 *
 * When RabbitMQ is not available (local dev), the publisher
 * silently no-ops — no crash, no missing bean error.
 */
@Service
@Slf4j
public class SuburbAlertPublisher {

    private final Optional<RabbitTemplate> rabbitTemplate;

    @Autowired
    public SuburbAlertPublisher(Optional<RabbitTemplate> rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    /**
     * Publishes an alert event if the suburb has escalated to
     * a concerning level (ORANGE or RED).
     */
    public void publishIfEscalated(String suburbId, String suburbName,
                                    int heatScore, String alertLevel) {
        if (!"RED".equals(alertLevel) && !"ORANGE".equals(alertLevel)) {
            return; // Only publish for elevated alert levels
        }

        if (rabbitTemplate.isEmpty()) {
            log.debug("RabbitMQ not configured — skipping alert publish for suburb={} level={}", suburbName, alertLevel);
            return;
        }

        Map<String, Object> event = Map.of(
                "suburbId", suburbId,
                "suburbName", suburbName,
                "heatScore", heatScore,
                "alertLevel", alertLevel,
                "triggeredAt", LocalDateTime.now().toString()
        );

        rabbitTemplate.get().convertAndSend(
                RabbitMQConfig.EXCHANGE,
                RabbitMQConfig.ROUTING_KEY,
                event
        );

        log.info("Published suburb alert → queue={} suburb={} level={}",
                RabbitMQConfig.QUEUE, suburbName, alertLevel);
    }
}
