package com.example.rag.domain;

/**
 * 知识库成员权限。
 *
 * <p>OWNER 由知识库创建者或平台管理员隐式获得，不允许作为成员权限手动分配。
 * VIEWER 面向普通问答用户，EDITOR 可维护文档，MANAGER 可维护成员、配置和索引。</p>
 */
public enum KbPermission {
    OWNER, MANAGER, EDITOR, VIEWER
}
