package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.DocumentChunk;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DocumentChunkMapper extends BaseMapper<DocumentChunk> {
    int deleteByDocumentId(@Param("documentId") Long documentId);

    DocumentChunk selectChunkById(@Param("id") Long id);

    List<DocumentChunk> selectByDocumentId(@Param("documentId") Long documentId);

    List<DocumentChunk> selectByDocumentIdAndTenantId(@Param("documentId") Long documentId, @Param("tenantId") Long tenantId);

    List<DocumentChunk> selectByKnowledgeBaseId(@Param("knowledgeBaseId") Long knowledgeBaseId);

    int countByTenantIdAndKnowledgeBaseId(@Param("tenantId") Long tenantId, @Param("knowledgeBaseId") Long knowledgeBaseId);

    List<ChunkSearchRow> keywordSearch(@Param("tenantId") Long tenantId,
                                       @Param("knowledgeBaseId") Long knowledgeBaseId,
                                       @Param("query") String query,
                                       @Param("like") String like,
                                       @Param("topK") int topK);
}
