param(
    [string]$MysqlContainer = "ragkb-mysql",
    [string]$MysqlUser = "rag",
    [string]$MysqlPassword = "rag",
    [string]$MysqlDatabase = "ragkb",
    [string]$EmailLike = "codex-e2e-%@example.com",
    [string]$KnowledgeBaseNameLike = "E2E KB %",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Escape-SqlLiteral {
    param([string]$Value)
    return $Value.Replace("'", "''")
}

function Invoke-Docker {
    param([string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

$emailPattern = Escape-SqlLiteral $EmailLike
$kbNamePattern = Escape-SqlLiteral $KnowledgeBaseNameLike
$mode = if ($Force) { "DELETE" } else { "DRY_RUN" }

Write-Host "Scanning E2E data in $MysqlContainer/$MysqlDatabase..."
Write-Host "Mode: $mode"
Write-Host "User email pattern: $EmailLike"
Write-Host "Knowledge base name pattern: $KnowledgeBaseNameLike"

$deleteBlock = if ($Force) {
@"
DELETE mc FROM message_citations mc
LEFT JOIN tmp_e2e_message_ids tm ON tm.id = mc.message_id
LEFT JOIN tmp_e2e_document_ids td ON td.id = mc.document_id
LEFT JOIN tmp_e2e_chunk_ids tc ON tc.id = mc.chunk_id
WHERE tm.id IS NOT NULL OR td.id IS NOT NULL OR tc.id IS NOT NULL;

DELETE m FROM messages m JOIN tmp_e2e_message_ids t ON t.id = m.id;
DELETE c FROM conversations c JOIN tmp_e2e_conversation_ids t ON t.id = c.id;
DELETE al FROM audit_logs al
LEFT JOIN tmp_e2e_user_ids tu ON tu.id = al.user_id
LEFT JOIN tmp_e2e_kb_ids tk ON tk.id = al.target_id AND al.target_type = 'KNOWLEDGE_BASE'
LEFT JOIN tmp_e2e_document_ids td ON td.id = al.target_id AND al.target_type = 'DOCUMENT'
LEFT JOIN tmp_e2e_task_ids tt ON tt.id = al.target_id AND al.target_type = 'RAG_TASK'
WHERE tu.id IS NOT NULL
   OR tk.id IS NOT NULL
   OR td.id IS NOT NULL
   OR tt.id IS NOT NULL
   OR al.detail LIKE '%codex-e2e-%'
   OR al.detail LIKE '%E2E KB %';
DELETE dc FROM document_chunks dc JOIN tmp_e2e_chunk_ids t ON t.id = dc.id;
DELETE rt FROM rag_tasks rt JOIN tmp_e2e_task_ids t ON t.id = rt.id;
DELETE d FROM documents d JOIN tmp_e2e_document_ids t ON t.id = d.id;
DELETE km FROM knowledge_base_members km
LEFT JOIN tmp_e2e_kb_ids tk ON tk.id = km.knowledge_base_id
LEFT JOIN tmp_e2e_user_ids tu ON tu.id = km.user_id
WHERE tk.id IS NOT NULL OR tu.id IS NOT NULL;
DELETE kb FROM knowledge_bases kb JOIN tmp_e2e_kb_ids t ON t.id = kb.id;
DELETE ur FROM user_roles ur JOIN tmp_e2e_user_ids t ON t.id = ur.user_id;
DELETE u FROM users u JOIN tmp_e2e_user_ids t ON t.id = u.id;
"@
} else {
@"
SELECT 'dry_run_only' AS mode, 'Re-run with -Force to delete the rows listed above.' AS message;
"@
}

$sql = @"
DROP TEMPORARY TABLE IF EXISTS tmp_e2e_user_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_e2e_kb_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_e2e_document_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_e2e_chunk_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_e2e_task_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_e2e_conversation_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_e2e_message_ids;

CREATE TEMPORARY TABLE tmp_e2e_user_ids (id BIGINT PRIMARY KEY);
CREATE TEMPORARY TABLE tmp_e2e_kb_ids (id BIGINT PRIMARY KEY);
CREATE TEMPORARY TABLE tmp_e2e_document_ids (id BIGINT PRIMARY KEY);
CREATE TEMPORARY TABLE tmp_e2e_chunk_ids (id BIGINT PRIMARY KEY);
CREATE TEMPORARY TABLE tmp_e2e_task_ids (id BIGINT PRIMARY KEY);
CREATE TEMPORARY TABLE tmp_e2e_conversation_ids (id BIGINT PRIMARY KEY);
CREATE TEMPORARY TABLE tmp_e2e_message_ids (id BIGINT PRIMARY KEY);

INSERT IGNORE INTO tmp_e2e_user_ids
SELECT id FROM users WHERE email LIKE '$emailPattern';

INSERT IGNORE INTO tmp_e2e_kb_ids
SELECT id FROM knowledge_bases
WHERE owner_id IN (SELECT id FROM tmp_e2e_user_ids)
   OR name LIKE '$kbNamePattern';

INSERT IGNORE INTO tmp_e2e_document_ids
SELECT id FROM documents
WHERE uploaded_by IN (SELECT id FROM tmp_e2e_user_ids)
   OR knowledge_base_id IN (SELECT id FROM tmp_e2e_kb_ids);

INSERT IGNORE INTO tmp_e2e_chunk_ids
SELECT id FROM document_chunks
WHERE document_id IN (SELECT id FROM tmp_e2e_document_ids);

INSERT IGNORE INTO tmp_e2e_task_ids
SELECT id FROM rag_tasks
WHERE document_id IN (SELECT id FROM tmp_e2e_document_ids)
   OR knowledge_base_id IN (SELECT id FROM tmp_e2e_kb_ids);

INSERT IGNORE INTO tmp_e2e_conversation_ids
SELECT id FROM conversations
WHERE user_id IN (SELECT id FROM tmp_e2e_user_ids)
   OR knowledge_base_id IN (SELECT id FROM tmp_e2e_kb_ids);

INSERT IGNORE INTO tmp_e2e_message_ids
SELECT id FROM messages
WHERE conversation_id IN (SELECT id FROM tmp_e2e_conversation_ids);

SELECT 'users' AS table_name, COUNT(*) AS rows_to_clean FROM tmp_e2e_user_ids;
SELECT 'knowledge_bases' AS table_name, COUNT(*) AS rows_to_clean FROM tmp_e2e_kb_ids;
SELECT 'documents' AS table_name, COUNT(*) AS rows_to_clean FROM tmp_e2e_document_ids;
SELECT 'rag_tasks' AS table_name, COUNT(*) AS rows_to_clean FROM tmp_e2e_task_ids;
SELECT 'conversations' AS table_name, COUNT(*) AS rows_to_clean FROM tmp_e2e_conversation_ids;
SELECT 'messages' AS table_name, COUNT(*) AS rows_to_clean FROM tmp_e2e_message_ids;
SELECT 'message_citations' AS table_name, COUNT(*) AS rows_to_clean FROM message_citations mc
    LEFT JOIN tmp_e2e_message_ids tm ON tm.id = mc.message_id
    LEFT JOIN tmp_e2e_document_ids td ON td.id = mc.document_id
    LEFT JOIN tmp_e2e_chunk_ids tc ON tc.id = mc.chunk_id
    WHERE tm.id IS NOT NULL OR td.id IS NOT NULL OR tc.id IS NOT NULL;
SELECT 'document_chunks' AS table_name, COUNT(*) AS rows_to_clean FROM tmp_e2e_chunk_ids;
SELECT 'knowledge_base_members' AS table_name, COUNT(*) AS rows_to_clean FROM knowledge_base_members
    WHERE knowledge_base_id IN (SELECT id FROM tmp_e2e_kb_ids) OR user_id IN (SELECT id FROM tmp_e2e_user_ids);
SELECT 'user_roles' AS table_name, COUNT(*) AS rows_to_clean FROM user_roles WHERE user_id IN (SELECT id FROM tmp_e2e_user_ids);
SELECT 'audit_logs' AS table_name, COUNT(*) AS rows_to_clean FROM audit_logs al
    LEFT JOIN tmp_e2e_user_ids tu ON tu.id = al.user_id
    LEFT JOIN tmp_e2e_kb_ids tk ON tk.id = al.target_id AND al.target_type = 'KNOWLEDGE_BASE'
    LEFT JOIN tmp_e2e_document_ids td ON td.id = al.target_id AND al.target_type = 'DOCUMENT'
    LEFT JOIN tmp_e2e_task_ids tt ON tt.id = al.target_id AND al.target_type = 'RAG_TASK'
    WHERE tu.id IS NOT NULL
       OR tk.id IS NOT NULL
       OR td.id IS NOT NULL
       OR tt.id IS NOT NULL
       OR al.detail LIKE '%codex-e2e-%'
       OR al.detail LIKE '%E2E KB %';

$deleteBlock
"@

$tempSql = Join-Path $env:TEMP "ragkb-cleanup-e2e-data.sql"
Set-Content -Encoding UTF8 -Path $tempSql -Value $sql

try {
    Invoke-Docker @("cp", $tempSql, "$MysqlContainer`:/tmp/ragkb-cleanup-e2e-data.sql")
    Invoke-Docker @("exec", $MysqlContainer, "mysql", "-u$MysqlUser", "-p$MysqlPassword", "-D$MysqlDatabase", "-e", "source /tmp/ragkb-cleanup-e2e-data.sql")
    Invoke-Docker @("exec", $MysqlContainer, "rm", "/tmp/ragkb-cleanup-e2e-data.sql")
} finally {
    Remove-Item -Force $tempSql -ErrorAction SilentlyContinue
}

if ($Force) {
    Write-Host "E2E MySQL data cleanup completed."
    Write-Host "Note: this script does not delete MinIO objects or Milvus vectors. E2E normally deletes uploaded documents through the API before this cleanup is needed."
} else {
    Write-Host "Dry run completed. No rows were deleted."
}
