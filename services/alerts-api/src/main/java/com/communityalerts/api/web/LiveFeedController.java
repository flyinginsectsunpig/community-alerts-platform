package com.communityalerts.api.web;

import com.communityalerts.api.service.LiveFeedService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/alerts")
public class LiveFeedController {

    private final LiveFeedService liveFeedService;

    public LiveFeedController(LiveFeedService liveFeedService) {
        this.liveFeedService = liveFeedService;
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return liveFeedService.subscribe();
    }
}
