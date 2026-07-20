package com.example.rag;

import com.example.rag.audit.AuditLogService;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.UserAccount;
import com.example.rag.document.DocumentService;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.DocumentChunkMapper;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.MessageCitationMapper;
import com.example.rag.mapper.RagTaskMapper;
import com.example.rag.retrieval.VectorIndexService;
import com.example.rag.storage.StorageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.core.context.SecurityContextHolder.clearContext;

class DocumentServiceConsistencyTest {
    private final KnowledgeBaseService knowledgeBaseService = mock(KnowledgeBaseService.class);
    private final DocumentMapper documentMapper = mock(DocumentMapper.class);
    private final DocumentChunkMapper chunkMapper = mock(DocumentChunkMapper.class);
    private final RagTaskMapper taskMapper = mock(RagTaskMapper.class);
    private final MessageCitationMapper citationMapper = mock(MessageCitationMapper.class);
    private final VectorIndexService vectorIndexService = mock(VectorIndexService.class);
    private final StorageService storageService = mock(StorageService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);

    private DocumentService documentService;

    @BeforeEach
    void setUp() {
        documentService = new DocumentService(
                knowledgeBaseService,
                documentMapper,
                chunkMapper,
                taskMapper,
                citationMapper,
                vectorIndexService,
                storageService,
                testProperties(),
                auditLogService);
    }

    @AfterEach
    void tearDown() {
        clearContext();
    }

    @Test
    void deleteDocumentCleansCitationsVectorsChunksTasksMetadataAndObject() {
        UserAccount user = TestSecurity.login(10L, 1L, "editor@example.com", "资料维护", "USER");
        DocumentEntity document = new DocumentEntity();
        document.setId(100L);
        document.setTenantId(1L);
        document.setKnowledgeBaseId(200L);
        document.setFileName("policy.md");
        document.setObjectKey("1/100/policy.md");
        KnowledgeBase kb = new KnowledgeBase();
        kb.setId(200L);
        kb.setTenantId(1L);
        kb.setOwnerId(10L);
        when(documentMapper.selectByIdAndTenantId(100L, 1L)).thenReturn(document);
        when(knowledgeBaseService.requireContentManageAccess(200L)).thenReturn(kb);
        when(chunkMapper.deleteByDocumentId(100L)).thenReturn(2);
        when(taskMapper.deleteByDocumentId(100L)).thenReturn(1);
        when(documentMapper.deleteByIdAndTenantId(100L, 1L)).thenReturn(1);

        documentService.delete(100L);

        verify(citationMapper).deleteByDocumentId(100L);
        verify(vectorIndexService).deleteVectorIndexByDocument(100L);
        verify(chunkMapper).deleteByDocumentId(100L);
        verify(taskMapper).deleteByDocumentId(100L);
        verify(documentMapper).deleteByIdAndTenantId(100L, 1L);
        verify(storageService).deleteQuietly("1/100/policy.md");
        verify(auditLogService).record(eq(user), eq("DOCUMENT_DELETE"), eq("DOCUMENT"), eq(100L), any());
    }

    private static AppProperties testProperties() {
        return new AppProperties(
                new AppProperties.Security("secret", 60),
                new AppProperties.Storage("http://localhost:9000", "a", "b", "bucket"),
                new AppProperties.Milvus("http://localhost:19530", "default", "rag_document_chunks", false),
                new AppProperties.Model("http://localhost", "", "chat", "embedding", 1536),
                new AppProperties.Ingestion(true, 1000, 3, 1, 600000),
                new AppProperties.Retrieval(0.65, 0.35));
    }
}
