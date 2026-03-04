package com.communityalerts.service;

import com.communityalerts.model.Incident;
import com.communityalerts.model.IncidentType;
import com.communityalerts.model.Suburb;
import com.communityalerts.repository.IncidentRepository;
import com.communityalerts.repository.SuburbRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private final IncidentRepository incidentRepository;
    private final SuburbRepository suburbRepository;
    private final HeatScoreService heatScoreService;

    @Transactional
    public Map<String, Integer> importIncidents(MultipartFile file) {
        int rowsProcessed = 0;
        int incidentsAdded = 0;
        int suburbsAdded = 0;

        try (InputStream is = file.getInputStream();
                Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0); // Take first sheet

            // Iterate over all rows, skip header
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null)
                    continue;

                rowsProcessed++;

                // Offence is col 0, Station is col 3 based on inspection
                // You might need to adjust indices if the structure is different
                Cell offenceCell = row.getCell(0, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                Cell stationCell = row.getCell(3, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);

                if (offenceCell == null || stationCell == null)
                    continue;

                String offenceStr = getCellValue(offenceCell);
                String stationStr = getCellValue(stationCell);

                if (offenceStr == null || offenceStr.isEmpty() || stationStr == null || stationStr.isEmpty())
                    continue;

                // Make sure Suburb exists, or create new
                String suburbId = stationStr.toLowerCase().replaceAll("[^a-z0-9]", "-");
                boolean isNewSuburb = !suburbRepository.existsById(suburbId);
                Suburb suburb = suburbRepository.findById(suburbId).orElseGet(() -> {
                    Suburb newSuburb = Suburb.builder()
                            .id(suburbId)
                            .name(stationStr)
                            .latitude(-33.9249) // Default CPT
                            .longitude(18.4241) // Default CPT
                            .build();
                    return suburbRepository.save(newSuburb);
                });

                if (isNewSuburb) {
                    suburbsAdded++;
                }

                IncidentType type = IncidentTypeClassifier.classifyType(offenceStr);

                Incident incident = Incident.builder()
                        .suburb(suburb)
                        .type(type)
                        .severity(IncidentTypeClassifier.defaultSeverity(type))
                        .title("Reported: " + offenceStr)
                        .description("Imported from SAPS Crime Stats: " + offenceStr + " at " + stationStr)
                        .tags("Imported,SAPS")
                        .latitude(suburb.getLatitude())
                        .longitude(suburb.getLongitude())
                        .build();

                incidentRepository.save(incident);
                incidentsAdded++;
            }

            // Recalculate heat scores after massive import
            heatScoreService.recalculateAll();

        } catch (Exception e) {
            log.error("Failed to parse excel file", e);
            throw new RuntimeException("Failed to process Excel file: " + e.getMessage());
        }

        Map<String, Integer> result = new HashMap<>();
        result.put("rowsProcessed", rowsProcessed);
        result.put("incidentsAdded", incidentsAdded);
        result.put("suburbsAdded", suburbsAdded);
        return result;
    }

    private String getCellValue(Cell cell) {
        if (cell.getCellType() == CellType.STRING) {
            return cell.getStringCellValue().trim();
        } else if (cell.getCellType() == CellType.NUMERIC) {
            return String.valueOf(cell.getNumericCellValue());
        }
        return "";
    }

}
