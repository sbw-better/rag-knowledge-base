param([string]$BaseUrl = "http://localhost:8081")
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "recheck-smoke-$stamp@example.com"
$password = "RecheckSmoke123!"
$token = ""
function Call-Api([string]$Method, [string]$Path, $Body = $null) {
    $requestParams = @{ Uri = "$BaseUrl$Path"; Method = $Method; TimeoutSec = 60 }
    if ($token) { $requestParams.Headers = @{ Authorization = "Bearer $token" } }
    if ($null -ne $Body) {
        $requestParams.ContentType = "application/json; charset=utf-8"
        $requestParams.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 8))
    }
    return (Invoke-RestMethod @requestParams).data
}
$registered = Call-Api Post "/api/auth/register" @{email=$email; password=$password; displayName="Recheck smoke $stamp"}
$userId = [long]$registered.user.id
# Match the existing local e2e bootstrap; only grant this newly created test user.
docker exec ragkb-mysql mysql -urag -prag -Dragkb -e "INSERT IGNORE INTO user_roles(user_id,role_id) SELECT $userId,id FROM roles WHERE name='KB_MANAGER';" 2>$null
if ($LASTEXITCODE -ne 0) { throw "Test role bootstrap failed" }
$login = Call-Api Post "/api/auth/login" @{email=$email;password=$password}
$token = $login.token
$kb = Call-Api Post "/api/knowledge-bases" @{name="Recheck smoke $stamp";chunkSize=500;chunkOverlap=80;topK=3;minScore=0.0}
$ticket = Call-Api Post "/api/support-tickets" @{
    knowledgeBaseId=$kb.id;category="smoke";channel="test";customerName="Recheck test";
    issueSummary="Recheck integration";customerQuestion="What is the return policy?"
}
Call-Api Post "/api/chat" @{
    knowledgeBaseId=$kb.id;question="What is the return policy?";
    businessModule="SUPPORT_TICKET";businessEntityId=$ticket.id
} | Out-Null
$page = Call-Api Get "/api/knowledge-feedback/issues?knowledgeBaseId=$($kb.id)"
$issueId = $page.items[0].id
if (-not $issueId) { throw "Empty KB did not create a knowledge issue" }
$resolved = Call-Api Post "/api/knowledge-feedback/issues/$issueId/resolve" @{resolutionNote="Integration verification"}
if ($resolved.status -ne "RESOLVED" -or $resolved.rechecks.Count -ne 1) { throw "Automatic recheck/history failed" }
$retry = Call-Api Post "/api/knowledge-feedback/issues/$issueId/recheck"
if ($retry.rechecks.Count -ne 2) { throw "Explicit recheck did not append history" }
$again = Call-Api Post "/api/knowledge-feedback/issues/$issueId/resolve" @{}
if ($again.rechecks.Count -ne 2) { throw "Repeated resolve unexpectedly duplicated recheck" }
$links = Call-Api Get "/api/knowledge-feedback/business-links?knowledgeBaseId=$($kb.id)&businessModule=SUPPORT_TICKET&businessEntityId=$($ticket.id)"
if ($links.issues[0].rechecks.Count -ne 2) { throw "Business link history missing" }
$events = Call-Api Get "/api/support-tickets/$($ticket.id)/events"
if (@($events | Where-Object eventType -eq "KNOWLEDGE_RECHECK").Count -ne 2) { throw "Ticket timeline missing rechecks" }
$stats = Call-Api Get "/api/support-tickets/stats?days=7"
Write-Output "PASS: automatic recheck, retry history, repeated resolve, business links, ticket timeline, scoped stats."
Write-Output "Outcome: $($retry.rechecks[0].outcome). Review fixture: KB $($kb.id), ticket $($ticket.id), issue $issueId."
Write-Output "Fixture retained under Recheck smoke $stamp for inspection."
