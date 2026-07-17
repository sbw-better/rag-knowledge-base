package com.example.rag.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.UUID;

/**
 * 全局异常处理器。
 *
 * <p>Controller 和 Service 可以抛出业务异常，不需要每个接口手写 try/catch。
 * Spring MVC 捕获异常后会进入这里，并统一转换为 {@link ApiResponse} 格式，保证前端错误处理一致。</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 资源不存在，例如知识库、文档、任务或会话 ID 无效。
     */
    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<ApiResponse<Void>> notFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.fail(ex.getMessage()));
    }

    /**
     * 当前用户未登录或没有权限访问目标资源。
     */
    @ExceptionHandler({ForbiddenException.class, AccessDeniedException.class})
    ResponseEntity<ApiResponse<Void>> forbidden(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.fail(ex.getMessage()));
    }

    /**
     * 请求参数错误或业务校验失败。
     */
    @ExceptionHandler({BadRequestException.class, MethodArgumentNotValidException.class})
    ResponseEntity<ApiResponse<Void>> badRequest(Exception ex) {
        String message = ex instanceof MethodArgumentNotValidException validation
                ? validation.getBindingResult().getAllErrors().get(0).getDefaultMessage()
                : ex.getMessage();
        return ResponseEntity.badRequest().body(ApiResponse.fail(message));
    }

    /**
     * 未预期异常兜底。
     *
     * <p>这里会生成 requestId 写入日志和响应，前端提示中的“错误编号”可以用来反查后端日志。</p>
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiResponse<Void>> internal(Exception ex, HttpServletRequest request) {
        String requestId = UUID.randomUUID().toString();
        log.error("未处理异常。requestId={}, method={}, uri={}",
                requestId,
                request.getMethod(),
                request.getRequestURI(),
                ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail("服务器处理失败，请查看后端日志。错误编号：" + requestId));
    }
}
