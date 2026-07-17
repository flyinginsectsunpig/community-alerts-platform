package com.communityalerts.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Sends the reset link via Resend's HTTP API. Without an API key (local dev)
 * it logs the link instead so the flow stays testable. Failures are logged,
 * never thrown — the forgot-password endpoint must respond 204 either way so
 * it can't be used to probe which emails have accounts.
 */
@Component
public class ResendResetEmailSender implements ResetEmailSender {

    private static final Logger log = LoggerFactory.getLogger(ResendResetEmailSender.class);

    private final RestClient restClient;
    private final String apiKey;
    private final String from;

    public ResendResetEmailSender(@Value("${app.resend.api-key:}") String apiKey,
                                  @Value("${app.email.from}") String from,
                                  RestClient.Builder builder) {
        this.apiKey = apiKey;
        this.from = from;
        this.restClient = builder.baseUrl("https://api.resend.com").build();
    }

    @Override
    public void send(String email, String link) {
        if (apiKey.isBlank()) {
            // Dev convenience only: the link is a credential, so this fires
            // solely when no mail provider is configured.
            log.info("Password reset link for {} (no RESEND_API_KEY set): {}", email, link);
            return;
        }
        try {
            restClient.post()
                    .uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .body(Map.of(
                            "from", from,
                            "to", email,
                            "subject", "Reset your Community Alerts password",
                            "html", """
                                    <h2>Reset your password</h2>
                                    <p>Someone (hopefully you) asked to reset the password \
                                    for this Community Alerts account.</p>
                                    <p><a href="%s">Choose a new password</a> \
                                    — the link works once and expires in an hour.</p>
                                    <p>If this wasn't you, you can ignore this email.</p>
                                    """.formatted(link)))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Password reset email to {} failed", email, e);
        }
    }
}
