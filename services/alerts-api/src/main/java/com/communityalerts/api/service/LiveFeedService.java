package com.communityalerts.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fans Redis {@code alerts.live} messages out to connected SSE clients.
 */
@Service
public class LiveFeedService {

    private static final Logger log = LoggerFactory.getLogger(LiveFeedService.class);
    private static final long NO_TIMEOUT = 0L;

    private final Set<SseEmitter> emitters = ConcurrentHashMap.newKeySet();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(NO_TIMEOUT);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        emitters.add(emitter);
        try {
            emitter.send(SseEmitter.event().name("connected").data("{\"status\":\"subscribed\"}"));
        } catch (IOException e) {
            emitters.remove(emitter);
        }
        log.debug("SSE client subscribed ({} active)", emitters.size());
        return emitter;
    }

    public void broadcast(String json) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("alert").data(json));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }

    /** Keeps intermediaries (load balancers, proxies) from closing idle streams. */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("heartbeat").data("{}"));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }

    public int activeSubscribers() {
        return emitters.size();
    }
}
