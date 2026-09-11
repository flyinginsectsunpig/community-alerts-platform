package com.communityalerts.api.web;

import com.communityalerts.api.auth.CredentialThrottle;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * The throttles read their ceilings from application.properties, and nothing
 * else in this suite starts a Spring context — a missing or misspelled property
 * would surface only when the container boots. The deploy workflow smoke-checks
 * the web app and the worker but not this service, so that failure would roll
 * out looking green. These assemble the two beans against the real property
 * file, with no database, Redis or broker involved.
 */
class RateLimitWiringTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class))
            .withBean(StringRedisTemplate.class, () -> mock(StringRedisTemplate.class));

    @Test
    @DisplayName("the credential throttle builds from the shipped properties")
    void credentialThrottleWires() {
        runner.withUserConfiguration(CredentialThrottle.class)
                .run(context -> assertThat(context)
                        .hasNotFailed()
                        .hasSingleBean(CredentialThrottle.class));
    }

    @Test
    @DisplayName("the rate limit filter builds from the shipped properties")
    void rateLimitFilterWires() {
        runner.withUserConfiguration(RateLimitFilter.class)
                .run(context -> assertThat(context)
                        .hasNotFailed()
                        .hasSingleBean(RateLimitFilter.class));
    }
}
