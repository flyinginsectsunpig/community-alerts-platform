package com.communityalerts.service;

import com.communityalerts.dto.CommentRequest;
import com.communityalerts.dto.CommentResponse;
import com.communityalerts.model.Comment;
import com.communityalerts.model.Incident;
import com.communityalerts.repository.CommentRepository;
import com.communityalerts.repository.IncidentRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommentServiceImpl implements CommentService {

    private final CommentRepository  commentRepository;
    private final IncidentRepository incidentRepository;

    @Override
    @Transactional
    public CommentResponse addComment(Long incidentId, CommentRequest request) {
        Incident incident = incidentRepository.findById(incidentId)
            .orElseThrow(() -> new EntityNotFoundException("Incident not found: " + incidentId));

        Comment comment = Comment.builder()
            .incident(incident)
            .username(request.getUsername())
            .text(request.getText())
            .descriptionMatch(request.getDescriptionMatch() != null && request.getDescriptionMatch())
            .build();

        return toResponse(commentRepository.save(comment));
    }

    @Override
    public List<CommentResponse> getComments(Long incidentId) {
        if (!incidentRepository.existsById(incidentId)) {
            throw new EntityNotFoundException("Incident not found: " + incidentId);
        }
        return commentRepository
            .findByIncidentIdOrderByCreatedAtAsc(incidentId)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    private CommentResponse toResponse(Comment c) {
        return new CommentResponse(
            c.getId(),
            c.getIncident().getId(),
            c.getUsername(),
            c.getText(),
            c.getDescriptionMatch(),
            c.getCreatedAt()
        );
    }
}
