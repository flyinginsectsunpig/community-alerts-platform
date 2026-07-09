package com.communityalerts.api.messaging;

import com.communityalerts.api.messaging.events.AlertCreatedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AlertEventPublisher {

    public static final String ROUTING_KEY_CREATED = "alert.created";

    private static final Logger log = LoggerFactory.getLogger(AlertEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;

    public AlertEventPublisher(RabbitTemplate rabbitTemplate,
                               @Value("${app.amqp.exchange}") String exchange) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
    }

    /**
     * Best-effort: reporting must never depend on broker availability. The
     * alert is already persisted and on the live feed when this runs; if the
     * broker is down the alert simply stays UNSCORED/unenriched until the
     * pipeline is restored.
     */
    public void publishAlertCreated(AlertCreatedEvent event) {
        try {
            rabbitTemplate.convertAndSend(exchange, ROUTING_KEY_CREATED, event);
        } catch (AmqpException e) {
            log.error("Could not publish alert.created for {} — scoring and enrichment skipped",
                    event.alertId(), e);
        }
    }
}
