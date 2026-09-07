package com.example.rag;

import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;

class SupportTicketScopeSqlTest {
    @Test
    void allListAndDashboardQueriesFailClosedAndBindKnowledgeBaseScope() throws Exception {
        Configuration config = new Configuration();
        for (String name : List.of("SupportTicketMapper", "KnowledgeIssueMapper")) {
            String resource = "mapper/" + name + ".xml";
            try (var input = getClass().getClassLoader().getResourceAsStream(resource)) {
                new XMLMapperBuilder(input, config, resource, config.getSqlFragments()).parse();
            }
        }
        Map<String, Object> params = new HashMap<>();
        params.put("tenantId", 1L);
        params.put("overdueOnly", false);
        for (String statement : List.of(
                "SupportTicketMapper.countByTenantId", "SupportTicketMapper.selectPageByTenantId",
                "SupportTicketMapper.selectStatsByTenantId", "SupportTicketMapper.selectEventStatsByTenantId",
                "SupportTicketMapper.selectCategoryBucketsByTenantId", "SupportTicketMapper.selectChannelBucketsByTenantId",
                "SupportTicketMapper.selectPriorityBucketsByTenantId", "SupportTicketMapper.selectTrendByTenantId",
                "SupportTicketMapper.selectAgentStatsByTenantId",
                "KnowledgeIssueMapper.selectSupportTicketIssueStats", "KnowledgeIssueMapper.selectSupportTicketNoAnswerRank")) {
            var mapped = config.getMappedStatement("com.example.rag.mapper." + statement);
            params.put("knowledgeBaseIds", List.of());
            assertThat(mapped.getBoundSql(params).getSql()).as(statement).contains("AND 1 = 0");
            params.put("knowledgeBaseIds", null);
            assertThat(mapped.getBoundSql(params).getSql()).as(statement).contains("AND 1 = 0");
            params.put("knowledgeBaseIds", List.of(101L, 202L));
            var bound = mapped.getBoundSql(params);
            assertThat(bound.getSql()).as(statement).contains("knowledge_base_id IN").doesNotContain("AND 1 = 0");
            assertThat(bound.getParameterMappings().stream()
                    .filter(p -> p.getProperty().startsWith("__frch_kbId")).count()).as(statement).isGreaterThanOrEqualTo(2);
        }
    }
}
