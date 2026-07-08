package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.MessageCitation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MessageCitationMapper extends BaseMapper<MessageCitation> {
    @Select("select * from message_citations where message_id = #{messageId} order by created_at asc")
    List<MessageCitation> selectByMessageId(Long messageId);
}
