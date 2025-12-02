package com.example.excelhtmlbackend.model;

import java.time.LocalDateTime;
import java.util.UUID;

public class FileRecord {

    private UUID id;
    private String fileName;
    private String originalTitle;
    private String fileType;
    private String htmlContent;
    private String jsonlContent;
    private LocalDateTime createdAt;

    public FileRecord() {
    }

    public FileRecord(UUID id, String fileName, String originalTitle, String fileType,
                      String htmlContent, String jsonlContent, LocalDateTime createdAt) {
        this.id = id;
        this.fileName = fileName;
        this.originalTitle = originalTitle;
        this.fileType = fileType;
        this.htmlContent = htmlContent;
        this.jsonlContent = jsonlContent;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getOriginalTitle() {
        return originalTitle;
    }

    public void setOriginalTitle(String originalTitle) {
        this.originalTitle = originalTitle;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public String getHtmlContent() {
        return htmlContent;
    }

    public void setHtmlContent(String htmlContent) {
        this.htmlContent = htmlContent;
    }

    public String getJsonlContent() {
        return jsonlContent;
    }

    public void setJsonlContent(String jsonlContent) {
        this.jsonlContent = jsonlContent;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
