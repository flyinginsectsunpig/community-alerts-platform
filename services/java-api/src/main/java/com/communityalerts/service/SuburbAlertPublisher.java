package com.communityalerts.service;

import com.communityalerts.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Publishes suburb alert events to RabbitMQ when an alert level
 * escalates past a threshold (typically to RED).
 *
 * The .NET Notification service consumes these messages for
 * guaranteed delivery — no more relying on HTTP webhooks.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SuburbAlertPublisher {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Publishes an alert event if the suburb has escalated to
     * a concerning level (ORANGE or RED).
     */
    public void publishIfEscalated(String suburbId, String suburbName,
                                    int heatScore, String alertLevel) {
        if (!"RED".equals(alertLevel) && !"ORANGE".equals(alertLevel)) {
            return; // Only publish for elevated alert levels
        }

        Map<String, Object> event = Map.of(
                "suburbId", suburbId,
                "suburbName", suburbName,
                "heatScore", heatScore,
                "alertLevel", alertLevel,
                "triggeredAt", LocalDateTime.now().toString()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE,
                RabbitMQConfig.ROUTING_KEY,
                event
        );

        log.info("Published suburb alert → queue={} suburb={} level={}",
                RabbitMQConfig.QUEUE, suburbName, alertLevel);
    }
}
