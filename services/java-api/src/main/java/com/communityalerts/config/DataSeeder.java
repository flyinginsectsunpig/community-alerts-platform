package com.communityalerts.config;

import com.communityalerts.model.*;
import com.communityalerts.repository.*;
import com.communityalerts.service.HeatScoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Seeds the database with realistic Cape Town data on startup.
 * All suburb names, coordinates, and incident descriptions are
 * drawn from real Cape Town geography.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class DataSeeder {

    private final SuburbRepository   suburbRepository;
    private final IncidentRepository incidentRepository;
    private final CommentRepository  commentRepository;
    private final ForumPostRepository forumPostRepository;
    private final HeatScoreService   heatScoreService;

    @Bean
    CommandLineRunner seedData() {
        return args -> {
            if (suburbRepository.count() > 0) {
                log.info("Database already seeded, skipping.");
                return;
            }

            log.info("Seeding Cape Town community data...");

            // ── Suburbs ──────────────────────────────────────────────────────
            List<Suburb> suburbs = suburbRepository.saveAll(List.of(
                Suburb.builder().id("khaye").name("Khayelitsha")
                    .latitude(-34.042).longitude(18.676).build(),
                Suburb.builder().id("mitch").name("Mitchells Plain")
                    .latitude(-34.050).longitude(18.615).build(),
                Suburb.builder().id("gugulethu").name("Gugulethu")
                    .latitude(-33.979).longitude(18.578).build(),
                Suburb.builder().id("grassy").name("Grassy Park")
                    .latitude(-34.027).longitude(18.500).build(),
                Suburb.builder().id("athlone").name("Athlone")
                    .latitude(-33.969).longitude(18.516).build(),
                Suburb.builder().id("wood").name("Woodstock")
                    .latitude(-33.927).longitude(18.446).build(),
                Suburb.builder().id("obs").name("Observatory")
                    .latitude(-33.938).longitude(18.472).build(),
                Suburb.builder().id("clar").name("Claremont")
                    .latitude(-33.998).longitude(18.470).build(),
                Suburb.builder().id("bellv").name("Bellville")
                    .latitude(-33.900).longitude(18.629).build(),
                Suburb.builder().id("parow").name("Parow")
                    .latitude(-33.897).longitude(18.581).build(),
                Suburb.builder().id("gardensct").name("Gardens (CT)")
                    .latitude(-33.930).longitude(18.417).build(),
                Suburb.builder().id("tableview").name("Table View")
                    .latitude(-33.814).longitude(18.491).build()
            ));

            Suburb khaye     = find(suburbs, "khaye");
            Suburb mitch     = find(suburbs, "mitch");
            Suburb gugulethu = find(suburbs, "gugulethu");
            Suburb grassy    = find(suburbs, "grassy");
            Suburb athlone   = find(suburbs, "athlone");
            Suburb wood      = find(suburbs, "wood");
            Suburb obs       = find(suburbs, "obs");
            Suburb bellv     = find(suburbs, "bellv");

            // ── Incidents ────────────────────────────────────────────────────
            Incident i1 = incidentRepository.save(Incident.builder()
                .suburb(khaye).type(IncidentType.CRIME).severity(5)
                .title("Armed Robbery – BP Garage, Khayelitsha")
                .description("Two men robbed a cashier at gunpoint. Fled on foot toward the taxi rank.")
                .tags("Armed,Blue hoodie,Black jeans,Ran north")
                .latitude(-34.047).longitude(18.680).build());

            Incident i2 = incidentRepository.save(Incident.builder()
                .suburb(mitch).type(IncidentType.CRIME).severity(5)
                .title("Hijacking – Westgate Mall Parking")
                .description("Silver Polo hijacked at knifepoint. Two male suspects, one with red cap.")
                .tags("Silver VW Polo,Red cap,Knife,CA 443 GP")
                .latitude(-34.054).longitude(18.621).build());

            Incident i3 = incidentRepository.save(Incident.builder()
                .suburb(grassy).type(IncidentType.SUSPICIOUS).severity(3)
                .title("Suspicious Vehicle – Loitering outside school")
                .description("White Toyota Quantum with no plates. Driver watching school entrance for 20+ minutes.")
                .tags("White Quantum,No plates,Male driver,Dark glasses")
                .latitude(-34.030).longitude(18.502).build());

            Incident i4 = incidentRepository.save(Incident.builder()
                .suburb(bellv).type(IncidentType.POWER_OUTAGE).severity(2)
                .title("Power Outage – Durban Road & surrounds")
                .description("Large section of Bellville CBD is dark. Eskom stage 6 — transformer fault reported.")
                .tags("Eskom,Transformer fault,CBD,~6hr ETA")
                .latitude(-34.903).longitude(18.627).build());

            Incident i5 = incidentRepository.save(Incident.builder()
                .suburb(wood).type(IncidentType.ACCIDENT).severity(4)
                .title("Multi-vehicle collision – Victoria Rd")
                .description("3-car pile-up blocking two lanes. Emergency services on scene. Expect heavy delays.")
                .tags("Victoria Rd,3 cars,Ambulance on scene,Lane blocked")
                .latitude(-33.924).longitude(18.449).build());

            Incident i6 = incidentRepository.save(Incident.builder()
                .suburb(obs).type(IncidentType.FIRE).severity(5)
                .title("Structure fire – lower Observatory")
                .description("Informal dwelling alight. Fire spreading to adjacent structures. Residents evacuating.")
                .tags("Residential,Fire spreading,3 units on scene")
                .latitude(-33.940).longitude(18.476).build());

            Incident i7 = incidentRepository.save(Incident.builder()
                .suburb(gugulethu).type(IncidentType.CRIME).severity(5)
                .title("Stabbing – NY1 & NY111 intersection")
                .description("Man stabbed following an altercation. Suspect fled in a green Corolla heading west.")
                .tags("Green Corolla,Stabbing,Fled west,Victim hospitalised")
                .latitude(-33.982).longitude(18.575).build());

            Incident i8 = incidentRepository.save(Incident.builder()
                .suburb(athlone).type(IncidentType.INFO).severity(1)
                .title("Road closure – Klipfontein Rd")
                .description("Water main burst. Municipality working on repairs. Closed between Thornton and Vanguard.")
                .tags("Water main,Municipality,Road closed")
                .latitude(-33.972).longitude(18.519).build());

            // ── Comments ─────────────────────────────────────────────────────
            commentRepository.saveAll(List.of(
                Comment.builder().incident(i1).username("NaomiK")
                    .text("I was at the rank — saw two guys matching that description running past Pick n Pay.")
                    .descriptionMatch(true).build(),
                Comment.builder().incident(i1).username("T_Maart")
                    .text("Police are on scene now. Avoid the area.").build(),

                Comment.builder().incident(i2).username("DavidF")
                    .text("Spotted the Polo on Merrydale Ave heading toward Rocklands.")
                    .descriptionMatch(true).build(),

                Comment.builder().incident(i4).username("EskomCT")
                    .text("Our teams are on site. Estimated restoration by 21:00.").build(),
                Comment.builder().incident(i4).username("ShandaR")
                    .text("Generators running at the hospital, no impact there.").build(),

                Comment.builder().incident(i5).username("CapeTownTraffic")
                    .text("Use Albert Rd as alternative. Avoid Victoria Rd southbound.").build(),

                Comment.builder().incident(i6).username("FernR")
                    .text("3 units of Cape Town Fire on site. Hydrant at the corner of Lower Main.").build(),

                Comment.builder().incident(i8).username("CityofCT")
                    .text("Repairs underway. Estimated 4-6 hrs. Use Klipfontein Alternative.").build()
            ));

            // ── Forum Posts ───────────────────────────────────────────────────
            forumPostRepository.saveAll(List.of(
                ForumPost.builder().suburb(khaye).username("NomthandoS").likes(24)
                    .text("The garage robbery isn't the first this month — three on Mew Way this week. We need a CPF meeting ASAP.").build(),
                ForumPost.builder().suburb(khaye).username("XolaniM").likes(31)
                    .text("Agreed. I've been talking to the sector commander. Meeting proposed for Friday 18:00 at the community hall.").build(),
                ForumPost.builder().suburb(khaye).username("ZulusaB").likes(2)
                    .text("Can someone share the CPF contact number? I've recently moved to Site C.").build(),

                ForumPost.builder().suburb(mitch).username("RasheedaN").likes(15)
                    .text("Westgate area has been bad this month. Three hijackings I know of personally.").build(),
                ForumPost.builder().suburb(mitch).username("Deshan_M").likes(42)
                    .text("I saw the Polo on this app before they caught it. It was already reported stolen. This platform works.").build(),

                ForumPost.builder().suburb(grassy).username("MrsJooste").likes(8)
                    .text("The Quantum outside the school was reported. Police sent a patrol car and it left immediately.").build(),

                ForumPost.builder().suburb(obs).username("TamaraBV").likes(5)
                    .text("I can see the smoke from Woodstock. Terrible. Does anyone know if the Red Cross shelter has capacity?").build()
            ));

            // ── Recalculate all heat scores ───────────────────────────────────
            heatScoreService.recalculateAll();

            log.info("Seed complete — {} incidents, {} suburbs loaded.",
                incidentRepository.count(), suburbRepository.count());
        };
    }

    private Suburb find(List<Suburb> list, String id) {
        return list.stream().filter(s -> s.getId().equals(id)).findFirst().orElseThrow();
    }
}
