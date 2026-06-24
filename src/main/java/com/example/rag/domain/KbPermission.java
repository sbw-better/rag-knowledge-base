package com.example.rag.domain;

/**
 * 知识库成员权限。
 *
 * <p>当前 Service 主要判断是否存在成员关系；该枚举为后续细化只读、编辑、管理权限预留。</p>
 */
public enum KbPermission {
    OWNER, EDITOR, VIEWER
}
