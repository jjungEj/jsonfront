package com.example.excelhtmlbackend.repository;

import com.example.excelhtmlbackend.model.FileRecord;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileRecordRepository {
    FileRecord save(FileRecord record);
    Optional<FileRecord> findById(UUID id);
    List<FileRecord> findAll();
    void deleteById(UUID id);
    void deleteAll(Collection<UUID> ids);
}
