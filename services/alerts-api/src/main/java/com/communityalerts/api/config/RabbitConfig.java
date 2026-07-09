package com.communityalerts.api.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.config.ContainerCustomizer;
import org.springframework.amqp.rabbit.listener.SimpleMessageListenerContainer;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topology shared with the .NET worker and Python ML service. Every service
 * declares the exchanges idempotently and owns only its own queues:
 *   alert.created -> q.ml.alert-created (ML), q.worker.enrichment (worker)
 *   alert.scored  -> q.api.alert-scored (this API), q.worker.escalation (worker)
 * Failed messages dead-letter into alerts.dlx -> q.dead-letter.
 */
@Configuration
public class RabbitConfig {

    public static final String EXCHANGE = "alerts.topic";
    public static final String DEAD_LETTER_EXCHANGE = "alerts.dlx";
    public static final String DEAD_LETTER_QUEUE = "q.dead-letter";
    public static final String ROUTING_KEY_SCORED = "alert.scored";

    @Bean
    public TopicExchange alertsExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    public FanoutExchange deadLetterExchange() {
        return new FanoutExchange(DEAD_LETTER_EXCHANGE, true, false);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DEAD_LETTER_QUEUE).build();
    }

    @Bean
    public Binding deadLetterBinding() {
        return BindingBuilder.bind(deadLetterQueue()).to(deadLetterExchange());
    }

    @Bean
    public Queue alertScoredQueue(@Value("${app.amqp.scored-queue}") String queueName) {
        return QueueBuilder.durable(queueName)
                .deadLetterExchange(DEAD_LETTER_EXCHANGE)
                .build();
    }

    @Bean
    public Binding alertScoredBinding(Queue alertScoredQueue, TopicExchange alertsExchange) {
        return BindingBuilder.bind(alertScoredQueue).to(alertsExchange).with(ROUTING_KEY_SCORED);
    }

    /**
     * A broker outage (or bad credentials) must degrade the API — not kill
     * it. Listener containers keep retrying in the background instead of
     * failing application startup; reads and reporting stay available.
     */
    @Bean
    public ContainerCustomizer<SimpleMessageListenerContainer> resilientListenerContainers() {
        return container -> container.setPossibleAuthenticationFailureFatal(false);
    }

    @Bean
    public Jackson2JsonMessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         Jackson2JsonMessageConverter converter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(converter);
        return template;
    }
}
