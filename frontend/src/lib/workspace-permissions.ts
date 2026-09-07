import type { KnowledgeBaseResponse, UserResponse } from "../types";

export type WorkspaceCapabilities = {
  isAdmin: boolean;
  canCreateKnowledgeBase: boolean;
  canViewAdmin: boolean;
  canViewKnowledge: boolean;
  canViewSupport: boolean;
};

export function getWorkspaceCapabilities(user: UserResponse | null | undefined, knowledgeBases: KnowledgeBaseResponse[] = []): WorkspaceCapabilities {
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const canCreateKnowledgeBase = isAdmin || roles.includes("KB_MANAGER");
  const hasKnowledgeAccess = knowledgeBases.length > 0;
  const hasKnowledgeManageAccess = knowledgeBases.some(
    (kb) => kb.manageable || kb.canManageDocuments || kb.canManageMembers || kb.canManageConfig || kb.canManageOperations
  );

  return {
    isAdmin,
    canCreateKnowledgeBase,
    canViewAdmin: isAdmin,
    canViewKnowledge: canCreateKnowledgeBase || hasKnowledgeAccess,
    canViewSupport: isAdmin || hasKnowledgeManageAccess
  };
}
