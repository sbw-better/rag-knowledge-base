package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.DocumentChunk;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface DocumentChunkMapper extends BaseMapper<DocumentChunk> {
    @Delete("delete from document_chunks where document_id = #{documentId}")
    int deleteByDocumentId(Long documentId);

    @Select("select * from document_chunks where id = #{id} limit 1")
    DocumentChunk selectChunkById(Long id);

    @Select("select * from document_chunks where document_id = #{documentId} order by chunk_index asc")
    List<DocumentChunk> selectByDocumentId(Long documentId);

    @Select("""
            select c.id chunk_id, c.document_id, d.file_name, c.chunk_index, c.content,
                   case when lower(c.content) like #{like} then 1.0
                        else match(c.content) against (#{query} in natural language mode)
                   end score
            from document_chunks c
            join documents d on d.id = c.document_id
            where c.tenant_id = #{tenantId}
              and c.knowledge_base_id = #{knowledgeBaseId}
              and (lower(c.content) like #{like}
                   or match(c.content) against (#{query} in natural language mode))
            order by score desc
            limit #{topK}
            """)
    List<ChunkSearchRow> keywordSearch(@Param("tenantId") Long tenantId,
                                       @Param("knowledgeBaseId") Long knowledgeBaseId,
                                       @Param("query") String query,
                                       @Param("like") String like,
                                       @Param("topK") int topK);
}
