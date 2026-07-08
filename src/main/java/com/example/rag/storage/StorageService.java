package com.example.rag.storage;

import com.example.rag.common.BadRequestException;
import com.example.rag.config.AppProperties;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;

/**
 * MinIO 对象存储服务。
 *
 * <p>系统将上传原始文件保存到对象存储，数据库只保存 objectKey。这样可以避免大文件
 * 占用数据库空间，也便于后续替换为云厂商 OSS/S3/COS。</p>
 */
@Component
public class StorageService {
    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    public StorageService(MinioClient minioClient, AppProperties properties) {
        this.minioClient = minioClient;
        this.properties = properties;
    }

    private final MinioClient minioClient;
    private final AppProperties properties;

    public void ensureBucket() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(properties.storage().bucket()).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(properties.storage().bucket()).build());
            log.info("MinIO bucket created. bucket={}", properties.storage().bucket());
        } else {
            log.debug("MinIO bucket already exists. bucket={}", properties.storage().bucket());
        }
    }

    /**
     * 保存上传文件并返回 objectKey。objectKey 按 tenant/document 分层，便于排查和后续归档。
     */
    public String store(MultipartFile file, Long tenantId, Long documentId, String safeFileName) {
        String objectKey = tenantId + "/" + documentId + "/" + safeFileName;
        try (InputStream inputStream = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.storage().bucket())
                    .object(objectKey)
                    .contentType(file.getContentType())
                    .stream(inputStream, file.getSize(), -1)
                    .build());
            log.info("File stored to MinIO. bucket={}, objectKey={}, sizeBytes={}",
                    properties.storage().bucket(), objectKey, file.getSize());
            return objectKey;
        } catch (Exception ex) {
            log.warn("Failed to store file to MinIO. bucket={}, objectKey={}",
                    properties.storage().bucket(), objectKey);
            throw new BadRequestException("Failed to store file: " + ex.getMessage());
        }
    }

    /**
     * 打开对象输入流。调用方负责关闭返回的 InputStream。
     */
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
