package com.communityalerts;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class CommunityAlertsApplication {
    public static void main(String[] args) {
        SpringApplication.run(CommunityAlertsApplication.class, args);
    }
}
