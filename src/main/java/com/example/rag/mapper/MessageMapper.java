package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.MessageEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MessageMapper extends BaseMapper<MessageEntity> {
    @Select("select * from messages where conversation_id = #{conversationId} order by created_at asc")
    List<MessageEntity> selectByConversationIdOrderByCreatedAtAsc(Long conversationId);
}
