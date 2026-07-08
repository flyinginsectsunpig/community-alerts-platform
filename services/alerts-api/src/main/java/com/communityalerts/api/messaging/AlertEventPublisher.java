package com.communityalerts.api.messaging;

import com.communityalerts.api.messaging.events.AlertCreatedEvent;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AlertEventPublisher {

    public static final String ROUTING_KEY_CREATED = "alert.created";

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;

    public AlertEventPublisher(RabbitTemplate rabbitTemplate,
                               @Value("${app.amqp.exchange}") String exchange) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
    }

    public void publishAlertCreated(AlertCreatedEvent event) {
        rabbitTemplate.convertAndSend(exchange, ROUTING_KEY_CREATED, event);
    }
}
