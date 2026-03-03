package com.communityalerts.controller;

import com.communityalerts.dto.SuburbResponse;
import com.communityalerts.service.SuburbService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/suburbs")
@RequiredArgsConstructor
@Tag(name = "Suburbs", description = "Suburb heat scores and alert levels for the map overlay")
public class SuburbController {

    private final SuburbService suburbService;

    @GetMapping
    @Operation(summary = "Get all suburbs with heat scores",
               description = "Returns suburbs sorted by heat score descending. " +
                             "Alert levels: GREEN < 12 | YELLOW 12–19 | ORANGE 20–29 | RED >= 30")
    public List<SuburbResponse> findAll() {
        return suburbService.findAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single suburb by ID")
    public SuburbResponse findById(@PathVariable String id) {
        return suburbService.findById(id);
    }

    @PostMapping("/{id}/refresh-heat")
    @Operation(summary = "Force a heat score recalculation for a suburb",
               description = "Useful after bulk data imports or testing.")
    public SuburbResponse refreshHeat(@PathVariable String id) {
        return suburbService.refreshHeatScore(id);
    }
}
