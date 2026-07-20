package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.MessageEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface MessageMapper extends BaseMapper<MessageEntity> {
    List<MessageEntity> selectByConversationIdOrderByCreatedAtAsc(@Param("conversationId") Long conversationId);

    int deleteByConversationId(@Param("conversationId") Long conversationId);
}
