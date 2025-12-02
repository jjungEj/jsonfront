package com.example.excelhtmlbackend.dto;

import com.example.excelhtmlbackend.model.FileRecord;

import java.time.LocalDateTime;
import java.util.UUID;

public record FileRecordResponse(
        UUID id,
        String fileName,
        String originalTitle,
        String fileType,
        String htmlContent,
        LocalDateTime createdAt
) {
    public static FileRecordResponse from(FileRecord record) {
        return new FileRecordResponse(
                record.getId(),
                record.getFileName(),
                record.getOriginalTitle(),
                record.getFileType(),
                record.getHtmlContent(),
                record.getCreatedAt()
        );
    }
}
