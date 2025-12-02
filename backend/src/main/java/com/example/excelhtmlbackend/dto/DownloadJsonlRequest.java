package com.example.excelhtmlbackend.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public class DownloadJsonlRequest {

    @NotEmpty
    private List<UUID> recordIds;

    public List<UUID> getRecordIds() {
        return recordIds;
    }

    public void setRecordIds(List<UUID> recordIds) {
        this.recordIds = recordIds;
    }
}
