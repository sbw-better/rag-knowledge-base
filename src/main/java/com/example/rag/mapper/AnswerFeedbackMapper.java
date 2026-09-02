package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.AnswerFeedback;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface AnswerFeedbackMapper extends BaseMapper<AnswerFeedback> {
    AnswerFeedback selectByAssistantMessageIdAndUserId(@Param("assistantMessageId") Long assistantMessageId,
                                                       @Param("userId") Long userId);
}
