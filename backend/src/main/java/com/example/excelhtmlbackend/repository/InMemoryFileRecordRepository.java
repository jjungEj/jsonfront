package com.example.excelhtmlbackend.repository;

import com.example.excelhtmlbackend.model.FileRecord;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class InMemoryFileRecordRepository implements FileRecordRepository {

    private final Map<UUID, FileRecord> storage = new ConcurrentHashMap<>();

    @Override
    public FileRecord save(FileRecord record) {
        storage.put(record.getId(), record);
        return record;
    }

    @Override
    public Optional<FileRecord> findById(UUID id) {
        return Optional.ofNullable(storage.get(id));
    }

    @Override
    public List<FileRecord> findAll() {
        return storage.values().stream()
                .sorted(Comparator.comparing(FileRecord::getCreatedAt).reversed())
                .toList();
    }

    @Override
    public void deleteById(UUID id) {
        storage.remove(id);
    }

    @Override
    public void deleteAll(Collection<UUID> ids) {
        ids.forEach(storage::remove);
    }
}
