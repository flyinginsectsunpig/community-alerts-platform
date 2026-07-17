package com.communityalerts.api.service;

/** Delivers the password reset link; implementations must never throw. */
public interface ResetEmailSender {

    void send(String email, String link);
}
