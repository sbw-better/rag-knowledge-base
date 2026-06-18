package com.example.rag.storage;

import com.example.rag.common.BadRequestException;
import com.example.rag.config.AppProperties;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class StorageService {
    private final MinioClient minioClient;
    private final AppProperties properties;

    public void ensureBucket() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(properties.storage().bucket()).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(properties.storage().bucket()).build());
        }
    }

    public String store(MultipartFile file, UUID tenantId, UUID documentId) {
        String objectKey = tenantId + "/" + documentId + "/" + file.getOriginalFilename();
        try (InputStream inputStream = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.storage().bucket())
                    .object(objectKey)
                    .contentType(file.getContentType())
                    .stream(inputStream, file.getSize(), -1)
                    .build());
            return objectKey;
        } catch (Exception ex) {
            throw new BadRequestException("Failed to store file: " + ex.getMessage());
        }
    }

    public InputStream open(String objectKey) {
        try {
            return minioClient.getObject(GetObjectArgs.builder()
                    .bucket(properties.storage().bucket())
                    .object(objectKey)
                    .build());
        } catch (Exception ex) {
            throw new BadRequestException("Failed to read stored file: " + ex.getMessage());
        }
    }
}
