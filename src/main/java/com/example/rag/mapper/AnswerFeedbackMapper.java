package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.AnswerFeedback;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AnswerFeedbackMapper extends BaseMapper<AnswerFeedback> {
    AnswerFeedback selectByAssistantMessageIdAndUserId(@Param("assistantMessageId") Long assistantMessageId,
                                                       @Param("userId") Long userId);

    List<AnswerFeedback> selectByBusiness(
            @Param("tenantId") Long tenantId,
            @Param("knowledgeBaseId") Long knowledgeBaseId,
            @Param("businessModule") String businessModule,
            @Param("businessEntityId") String businessEntityId,
            @Param("limit") int limit);
}
