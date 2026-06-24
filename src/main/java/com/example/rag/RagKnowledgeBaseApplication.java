package com.example.rag;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
@ConfigurationPropertiesScan
public class RagKnowledgeBaseApplication {
    /**
     * 后端应用启动入口。
     *
     * <p>无论是在 IDEA 中点击运行，还是通过 {@code java -jar} 启动，JVM 都会先执行
     * 这个 main 方法。{@link SpringApplication#run(Class, String...)} 会创建 Spring
     * 容器，扫描 {@code com.example.rag} 包下的 Controller、Service、Component、
     * Configuration、Repository，并完成数据库、Security、定时任务等基础设施初始化。</p>
     *
     * <p>{@link EnableScheduling} 会开启 Spring 定时任务能力，文档入库 worker 里的
     * {@code @Scheduled} 方法才会在项目启动后按周期执行。</p>
     */
    public static void main(String[] args) {
        SpringApplication.run(RagKnowledgeBaseApplication.class, args);
    }
}
