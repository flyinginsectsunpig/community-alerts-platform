package com.communityalerts.api.service;

import com.communityalerts.api.domain.DigestFrequency;
import com.communityalerts.api.domain.User;
import com.communityalerts.api.error.BadRequestException;
import com.communityalerts.api.error.NotFoundException;
import com.communityalerts.api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @Mock
    private UserRepository userRepository;

    private ProfileService profileService;

    @BeforeEach
    void setUp() {
        profileService = new ProfileService(userRepository);
    }

    @Test
    @DisplayName("updating the digest frequency persists it")
    void updateDigestFrequency() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = profileService.updateDigestFrequency(userId, DigestFrequency.WEEKLY);

        assertThat(response.digestFrequency()).isEqualTo(DigestFrequency.WEEKLY);
        verify(userRepository).save(user);
        assertThat(user.getDigestFrequency()).isEqualTo(DigestFrequency.WEEKLY);
    }

    @Test
    @DisplayName("updating the danger reach persists it")
    void updateDangerReach_persists() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = profileService.updateDangerReach(userId, 5000);

        assertThat(response.dangerReachM()).isEqualTo(5000);
        assertThat(user.getDangerReachM()).isEqualTo(5000);
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("a null danger reach turns the warnings off")
    void updateDangerReach_nullTurnsOff() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setDangerReachM(5000);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = profileService.updateDangerReach(userId, null);

        assertThat(response.dangerReachM()).isNull();
        assertThat(user.getDangerReachM()).isNull();
    }

    @Test
    @DisplayName("a danger reach outside the allowed options is rejected")
    void updateDangerReach_rejectsOtherValues() {
        UUID userId = UUID.randomUUID();

        assertThatThrownBy(() -> profileService.updateDangerReach(userId, 3000))
                .isInstanceOf(BadRequestException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("the profile exposes the danger reach")
    void profile_exposesDangerReach() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setDangerReachM(10000);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThat(profileService.profile(userId).dangerReachM()).isEqualTo(10000);
    }

    @Test
    @DisplayName("profile lookups for unknown users fail loudly")
    void unknownUserThrows() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> profileService.profile(userId))
                .isInstanceOf(NotFoundException.class);
    }
}
