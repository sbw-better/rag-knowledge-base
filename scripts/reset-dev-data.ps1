param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not $Force) {
    throw "This will delete all development users, tenants, knowledge bases, documents, tasks, conversations, chunks and audit logs from MySQL. Re-run with -Force if you really want to reset development data."
}

Write-Host "Resetting development MySQL data in ragkb-mysql..."

$sql = @"
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM message_citations;
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM audit_logs;
DELETE FROM document_chunks;
DELETE FROM rag_tasks;
DELETE FROM documents;
DELETE FROM knowledge_base_members;
DELETE FROM knowledge_bases;
DELETE FROM user_roles;
DELETE FROM users;
DELETE FROM tenants;
SET FOREIGN_KEY_CHECKS = 1;
"@

$tempSql = Join-Path $env:TEMP "ragkb-reset-dev-data.sql"
Set-Content -Encoding UTF8 -Path $tempSql -Value $sql

docker cp $tempSql ragkb-mysql:/tmp/ragkb-reset-dev-data.sql
docker exec ragkb-mysql mysql -urag -prag ragkb -e "source /tmp/ragkb-reset-dev-data.sql"
docker exec ragkb-mysql rm /tmp/ragkb-reset-dev-data.sql
Remove-Item -Force $tempSql

Write-Host "Development MySQL data reset completed."
Write-Host "Note: this script does not delete MinIO objects or Milvus vectors. If needed, clear Docker volumes manually after backing up important data."
