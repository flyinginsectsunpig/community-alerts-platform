package com.communityalerts.api.dto;

import com.communityalerts.api.domain.DigestFrequency;
import com.communityalerts.api.domain.User;

public record ProfileResponse(DigestFrequency digestFrequency) {

    public static ProfileResponse from(User user) {
        return new ProfileResponse(user.getDigestFrequency());
    }
}
