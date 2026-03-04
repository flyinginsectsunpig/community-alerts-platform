package com.communityalerts.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ exchange, queue, and binding for suburb alert events.
 *
 * When HeatScoreServiceImpl detects a threshold crossing (e.g. a suburb
 * escalates to RED), it publishes a JSON event to the "suburb-alerts"
 * queue via the "community-alerts" topic exchange.
 *
 * The .NET Notification service consumes from this queue for guaranteed
 * delivery — replacing the old HTTP webhook pattern.
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE   = "community-alerts";
    public static final String QUEUE      = "suburb-alerts";
    public static final String ROUTING_KEY = "suburb.alert.escalated";

    @Bean
    public TopicExchange communityAlertsExchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public Queue suburbAlertsQueue() {
        return QueueBuilder.durable(QUEUE).build();
    }

    @Bean
    public Binding suburbAlertsBinding(Queue suburbAlertsQueue, TopicExchange communityAlertsExchange) {
        return BindingBuilder.bind(suburbAlertsQueue)
                .to(communityAlertsExchange)
                .with(ROUTING_KEY);
    }

    @Bean
    public Jackson2JsonMessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         Jackson2JsonMessageConverter converter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(converter);
        return template;
    }
}
