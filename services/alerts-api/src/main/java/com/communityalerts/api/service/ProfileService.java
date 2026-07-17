package com.communityalerts.api.service;

import com.communityalerts.api.domain.DigestFrequency;
import com.communityalerts.api.domain.User;
import com.communityalerts.api.dto.ProfileResponse;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ProfileService {

    private final UserRepository userRepository;

    public ProfileService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public ProfileResponse profile(UUID userId) {
        return ProfileResponse.from(findUser(userId));
    }

    @Transactional
    public ProfileResponse updateDigestFrequency(UUID userId, DigestFrequency frequency) {
        User user = findUser(userId);
        user.setDigestFrequency(frequency);
        return ProfileResponse.from(userRepository.save(user));
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User %s not found".formatted(userId)));
    }
}
