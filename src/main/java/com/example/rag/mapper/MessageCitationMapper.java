package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.MessageCitation;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MessageCitationMapper extends BaseMapper<MessageCitation> {
    @Select("select * from message_citations where message_id = #{messageId} order by created_at asc")
    List<MessageCitation> selectByMessageId(Long messageId);

    @Delete("delete from message_citations where document_id = #{documentId}")
    int deleteByDocumentId(Long documentId);

    @Delete("""
            delete from message_citations
            where message_id in (
                select id from messages where conversation_id = #{conversationId}
            )
            """)
    int deleteByConversationId(Long conversationId);
}
