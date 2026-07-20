package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.MessageCitation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface MessageCitationMapper extends BaseMapper<MessageCitation> {
    List<MessageCitation> selectByMessageId(@Param("messageId") Long messageId);

    int deleteByDocumentId(@Param("documentId") Long documentId);

    int deleteByConversationId(@Param("conversationId") Long conversationId);
}
