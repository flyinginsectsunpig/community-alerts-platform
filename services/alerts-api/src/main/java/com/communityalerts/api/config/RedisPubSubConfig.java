package com.communityalerts.api.config;

import com.communityalerts.api.service.LiveFeedService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

import java.nio.charset.StandardCharsets;

/**
 * Bridges the Redis {@code alerts.live} pub/sub channel into server-sent
 * events. Publishing through Redis (instead of in-process) keeps the live
 * feed correct when the API runs with multiple replicas.
 */
@Configuration
public class RedisPubSubConfig {

    public static final String LIVE_CHANNEL = "alerts.live";

    @Bean
    public RedisMessageListenerContainer redisListenerContainer(RedisConnectionFactory connectionFactory,
                                                                LiveFeedService liveFeedService) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(
                (message, pattern) -> liveFeedService.broadcast(new String(message.getBody(), StandardCharsets.UTF_8)),
                new ChannelTopic(LIVE_CHANNEL));
        return container;
    }
}
