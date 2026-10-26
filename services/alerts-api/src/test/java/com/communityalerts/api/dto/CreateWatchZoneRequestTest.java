package com.communityalerts.api.dto;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CreateWatchZoneRequestTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private Set<ConstraintViolation<CreateWatchZoneRequest>> validate(List<ZonePoint> polygon) {
        var request = new CreateWatchZoneRequest(
                "Home", null, null, null, null, null, polygon, JsonNodeFactory.instance.objectNode());
        return validator.validate(request);
    }

    @Test
    @DisplayName("null points in a drawn outline are a validation violation, not a server error")
    void nullPointsAreRejected() {
        var violations = validate(Arrays.asList(null, null, null));

        assertThat(violations).isNotEmpty();
        assertThat(violations).allSatisfy(v -> assertThat(v.getPropertyPath().toString()).startsWith("polygon"));
    }

    @Test
    @DisplayName("more than 500 points says so in the zone's own words")
    void tooManyPointsHasTheShapeRuleMessage() {
        var points = new ArrayList<ZonePoint>();
        for (int i = 0; i < 501; i++) {
            points.add(new ZonePoint(51.5, -0.1));
        }

        var violations = validate(points);

        assertThat(violations).extracting(ConstraintViolation::getMessage)
                .containsExactly("A drawn zone can have at most 500 points");
    }

    @Test
    @DisplayName("an outline of real points within the limit is accepted by the validator")
    void validOutlinePasses() {
        var points = List.of(new ZonePoint(51.5, -0.1), new ZonePoint(51.6, -0.1), new ZonePoint(51.6, -0.2));

        assertThat(validate(points)).isEmpty();
    }
}
