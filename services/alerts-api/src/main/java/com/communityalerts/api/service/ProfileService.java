package com.communityalerts.api.service;

import com.communityalerts.api.domain.DigestFrequency;
import com.communityalerts.api.domain.User;
import com.communityalerts.api.dto.ProfileResponse;
import com.communityalerts.api.error.BadRequestException;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

@Service
public class ProfileService {

    static final Set<Integer> DANGER_REACH_OPTIONS_M = Set.of(2000, 5000, 10000);

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

    @Transactional
    public ProfileResponse updateDangerReach(UUID userId, Integer reachM) {
        if (reachM != null && !DANGER_REACH_OPTIONS_M.contains(reachM)) {
            throw new BadRequestException("Reach must be 2000, 5000 or 10000 metres");
        }
        User user = findUser(userId);
        user.setDangerReachM(reachM);
        return ProfileResponse.from(userRepository.save(user));
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User %s not found".formatted(userId)));
    }
}
