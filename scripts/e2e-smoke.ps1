param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$AdminEmail = "",
    [string]$MysqlContainer = "ragkb-mysql",
    [string]$MysqlUser = "rag",
    [string]$MysqlPassword = "rag",
    [string]$MysqlDatabase = "ragkb",
    [switch]$CleanupBefore,
    [switch]$KeepData
)

$ErrorActionPreference = "Stop"
$Password = "CodexTest123456!"
$Timestamp = Get-Date -Format "yyyyMMddHHmmss"
$kbId = ""
$documentId = ""
$managerToken = ""
$adminToken = ""

if ($CleanupBefore) {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "cleanup-e2e-data.ps1") `
        -MysqlContainer $MysqlContainer `
        -MysqlUser $MysqlUser `
        -MysqlPassword $MysqlPassword `
        -MysqlDatabase $MysqlDatabase `
        -Force
    if ($LASTEXITCODE -ne 0) {
        throw "E2E cleanup before run failed"
    }
}

function Write-Pass {
    param([string]$Name, [string]$Detail = "")
    if ($Detail) {
        Write-Host "[PASS] $Name - $Detail"
    } else {
        Write-Host "[PASS] $Name"
    }
}

function Read-ErrorBody {
    param($ErrorRecord)
    try {
        $stream = $ErrorRecord.Exception.Response.GetResponseStream()
        if ($null -eq $stream) {
            return $ErrorRecord.Exception.Message
        }
        $reader = New-Object System.IO.StreamReader($stream)
        return $reader.ReadToEnd()
    } catch {
        return $ErrorRecord.Exception.Message
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Token = "",
        $Body = $null
    )

    $headers = @{}
    if ($Token) {
        $headers.Authorization = "Bearer $Token"
    }

    $params = @{
        Uri = "$BaseUrl$Path"
        Method = $Method
        Headers = $headers
        TimeoutSec = 45
        ErrorAction = "Stop"
    }
    if ($null -ne $Body) {
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = ($Body | ConvertTo-Json -Depth 20)
    }

    try {
        $response = Invoke-RestMethod @params
    } catch {
        $bodyText = Read-ErrorBody $_
        throw "HTTP $Method $Path failed: $bodyText"
    }

    if ($null -ne $response.success -and -not $response.success) {
        throw "API $Method $Path returned success=false: $($response.error | ConvertTo-Json -Depth 5)"
    }
    return $response
}

function Register-User {
    param([string]$Email, [string]$DisplayName)
    return Invoke-Api "Post" "/api/auth/register" "" @{
        email = $Email
        password = $Password
        displayName = $DisplayName
    }
}

function Login-User {
    param([string]$Email)
    return Invoke-Api "Post" "/api/auth/login" "" @{
        email = $Email
        password = $Password
    }
}

function Grant-RoleInDatabase {
    param([string]$UserId, [string]$RoleName)
    $sql = "insert ignore into user_roles(user_id, role_id) select $UserId, id from roles where name='$RoleName';"
    docker exec $MysqlContainer mysql "-u$MysqlUser" "-p$MysqlPassword" "-D$MysqlDatabase" -e $sql | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to grant $RoleName to user $UserId"
    }
}

function Expect-HttpFailure {
    param([string]$Name, [scriptblock]$Action)
    try {
        & $Action | Out-Null
    } catch {
        Write-Pass $Name $_.Exception.Message
        return
    }
    throw "$Name should have failed, but it succeeded"
}

function Cleanup-E2EData {
    if ($KeepData) {
        Write-Host "[INFO] KeepData enabled; E2E generated data is retained."
        return
    }
    if ($documentId -and $managerToken) {
        try {
            Invoke-Api "Delete" "/api/documents/$documentId" $managerToken | Out-Null
            Write-Pass "Cleanup uploaded document" "documentId=$documentId"
        } catch {
            Write-Host "[WARN] Cleanup document failed: $($_.Exception.Message)"
        }
    }
    if ($kbId -and $managerToken) {
        try {
            Invoke-Api "Delete" "/api/knowledge-bases/$kbId" $managerToken | Out-Null
            Write-Pass "Cleanup knowledge base" "kbId=$kbId"
        } catch {
            Write-Host "[WARN] Cleanup knowledge base failed: $($_.Exception.Message)"
        }
    }
}

trap {
    Cleanup-E2EData
    throw
}

$health = Invoke-RestMethod -Uri "$BaseUrl/actuator/health" -TimeoutSec 10 -ErrorAction Stop
if ($health.status -ne "UP") {
    throw "Backend health is not UP"
}
Write-Pass "Backend health" "UP"

if ([string]::IsNullOrWhiteSpace($AdminEmail)) {
    $adminEmail = "codex-e2e-admin-$Timestamp@example.com"
    $adminRegister = Register-User $adminEmail "E2E Admin"
    $adminId = $adminRegister.data.user.id
    Grant-RoleInDatabase $adminId "ADMIN"
    Write-Pass "Register and bootstrap ADMIN" "userId=$adminId"
} else {
    $adminEmail = $AdminEmail
    Write-Pass "Use existing ADMIN account" $adminEmail
}
$adminLogin = Login-User $adminEmail
$adminToken = $adminLogin.data.token
if (-not ($adminLogin.data.user.roles -contains "ADMIN")) {
    throw "Admin login did not include ADMIN role"
}
Write-Pass "ADMIN login" $adminEmail

$managerEmail = "codex-e2e-manager-$Timestamp@example.com"
$viewerEmail = "codex-e2e-viewer-$Timestamp@example.com"
$editorEmail = "codex-e2e-editor-$Timestamp@example.com"
$managerRegister = Register-User $managerEmail "E2E Manager"
$viewerRegister = Register-User $viewerEmail "E2E Viewer"
$editorRegister = Register-User $editorEmail "E2E Editor"
$managerId = $managerRegister.data.user.id
$viewerId = $viewerRegister.data.user.id
$editorId = $editorRegister.data.user.id
Write-Pass "Register test users" "manager=$managerId viewer=$viewerId editor=$editorId"

Invoke-Api "Patch" "/api/admin/users/$managerId/roles" $adminToken @{ roles = @("KB_MANAGER") } | Out-Null
$managerLogin = Login-User $managerEmail
$managerToken = $managerLogin.data.token
if (-not ($managerLogin.data.user.roles -contains "KB_MANAGER")) {
    throw "Manager login did not include KB_MANAGER role"
}
Write-Pass "ADMIN grants KB_MANAGER" $managerEmail

Expect-HttpFailure "USER cannot create knowledge base" {
    Invoke-Api "Post" "/api/knowledge-bases" $viewerRegister.data.token @{
        name = "Forbidden KB"
        description = "Should fail"
        chunkSize = 300
        chunkOverlap = 50
        topK = 3
        minScore = 0.0
    }
}

$kbName = "E2E KB $Timestamp"
$kbResponse = Invoke-Api "Post" "/api/knowledge-bases" $managerToken @{
    name = $kbName
    description = "End to end test knowledge base"
    chunkSize = 500
    chunkOverlap = 80
    topK = 3
    minScore = 0.0
}
$kbId = $kbResponse.data.id
if (-not $kbId -or $kbResponse.data.permission -ne "OWNER") {
    throw "Knowledge base creation did not return OWNER permission"
}
Write-Pass "KB_MANAGER creates knowledge base" "kbId=$kbId"

$viewerListBefore = Invoke-Api "Get" "/api/knowledge-bases?page=1&pageSize=50" $viewerRegister.data.token
$visibleBefore = @($viewerListBefore.data.items | Where-Object { $_.id -eq $kbId })
if ($visibleBefore.Count -gt 0) {
    throw "Viewer saw the knowledge base before authorization"
}
Write-Pass "Unauthorized USER cannot see knowledge base"

Invoke-Api "Post" "/api/knowledge-bases/$kbId/members" $managerToken @{ userId = $viewerId; permission = "VIEWER" } | Out-Null
Invoke-Api "Post" "/api/knowledge-bases/$kbId/members" $managerToken @{ userId = $editorId; permission = "EDITOR" } | Out-Null
Write-Pass "MANAGER grants VIEWER and EDITOR"

$viewerKnowledgeBase = Invoke-Api "Get" "/api/knowledge-bases/$kbId" $viewerRegister.data.token
if ($viewerKnowledgeBase.data.permission -ne "VIEWER") {
    throw "Viewer permission mismatch: $($viewerKnowledgeBase.data.permission)"
}
Write-Pass "VIEWER can access knowledge base detail"

Expect-HttpFailure "VIEWER cannot access document maintenance list" {
    Invoke-Api "Get" "/api/knowledge-bases/$kbId/documents" $viewerRegister.data.token
}

$emptyChat = Invoke-Api "Post" "/api/chat" $viewerRegister.data.token @{
    knowledgeBaseId = $kbId
    question = "What can you answer?"
    conversationId = $null
    topK = $null
}
if ($emptyChat.data.answerStatus -ne "EMPTY_KB" -or $emptyChat.data.citations.Count -ne 0) {
    throw "Empty KB chat should return EMPTY_KB without citations"
}
Write-Pass "Empty knowledge base chat returns EMPTY_KB"

$sample = Join-Path (Split-Path -Parent $PSScriptRoot) "samples\kb-test-docs\customer-service-policy.md"
$uploadRaw = & curl.exe -s -X POST -H "Authorization: Bearer $managerToken" -F "file=@$sample" "$BaseUrl/api/knowledge-bases/$kbId/documents"
$upload = $uploadRaw | ConvertFrom-Json
if (-not $upload.success) {
    throw "Upload failed: $uploadRaw"
}
$documentId = $upload.data.document.id
$taskId = $upload.data.task.id
Write-Pass "Upload Markdown document" "documentId=$documentId taskId=$taskId"

$taskStatus = ""
$taskError = ""
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    $task = Invoke-Api "Get" "/api/tasks/$taskId" $managerToken
    $taskStatus = $task.data.status
    $taskError = $task.data.errorMessage
    if ($taskStatus -in @("SUCCEEDED", "FAILED")) {
        break
    }
}
if ($taskStatus -ne "SUCCEEDED") {
    throw "Ingestion task did not succeed. status=$taskStatus error=$taskError"
}
Write-Pass "Document ingestion task succeeded"

$documents = Invoke-Api "Get" "/api/knowledge-bases/$kbId/documents?page=1&pageSize=10" $managerToken
if ($documents.data.total -lt 1) {
    throw "Uploaded document is not visible in document list"
}
Write-Pass "Document list pagination works" "total=$($documents.data.total)"

$chunks = Invoke-Api "Get" "/api/documents/$documentId/chunks" $managerToken
if ($chunks.data.Count -lt 1) {
    throw "Document chunks were not generated"
}
Write-Pass "Document chunks can be queried" "chunks=$($chunks.data.Count)"

$rebuildTask = Invoke-Api "Post" "/api/knowledge-bases/$kbId/rebuild-index" $managerToken
$rebuildTaskId = $rebuildTask.data.id
if ($rebuildTask.data.type -ne "REBUILD_KNOWLEDGE_BASE_INDEX" -or $rebuildTask.data.status -ne "PENDING") {
    throw "Rebuild index did not create pending task: $($rebuildTask.data | ConvertTo-Json -Depth 5)"
}
Write-Pass "Create async index rebuild task" "taskId=$rebuildTaskId"

$rebuildStatus = ""
$rebuildError = ""
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    $task = Invoke-Api "Get" "/api/tasks/$rebuildTaskId" $managerToken
    $rebuildStatus = $task.data.status
    $rebuildError = $task.data.errorMessage
    if ($rebuildStatus -in @("SUCCEEDED", "FAILED")) {
        break
    }
}
if ($rebuildStatus -ne "SUCCEEDED") {
    throw "Index rebuild task did not succeed. status=$rebuildStatus error=$rebuildError"
}
Write-Pass "Async index rebuild task succeeded" $rebuildError

$tasksPage = Invoke-Api "Get" "/api/tasks?knowledgeBaseId=$kbId&page=1&pageSize=10&type=REBUILD_KNOWLEDGE_BASE_INDEX&status=SUCCEEDED" $managerToken
$visibleRebuildTasks = @($tasksPage.data.items | Where-Object { $_.task.id -eq $rebuildTaskId })
if ($visibleRebuildTasks.Count -ne 1) {
    throw "Task center did not return completed rebuild task"
}
Write-Pass "Task center lists rebuild task" "total=$($tasksPage.data.total)"

$search = Invoke-Api "Post" "/api/search" $managerToken @{
    knowledgeBaseId = $kbId
    query = "refund policy"
    mode = "HYBRID"
    topK = 3
}
Write-Pass "HYBRID search endpoint works" "hits=$($search.data.hits.Count)"

$chat = Invoke-Api "Post" "/api/chat" $viewerRegister.data.token @{
    knowledgeBaseId = $kbId
    question = "How long does refund take after approval?"
    conversationId = $null
    topK = $null
}
if (-not $chat.data.conversationId) {
    throw "Chat did not return conversationId"
}
Write-Pass "VIEWER chat works" "status=$($chat.data.answerStatus) citations=$($chat.data.citations.Count)"

$latest = Invoke-Api "Get" "/api/conversations/latest?knowledgeBaseId=$kbId" $viewerRegister.data.token
if ($latest.data.id -ne $chat.data.conversationId) {
    throw "Latest conversation did not restore current conversation"
}
Write-Pass "Latest conversation restore works" "messages=$($latest.data.messages.Count)"

$conversations = Invoke-Api "Get" "/api/conversations?knowledgeBaseId=$kbId&page=1&pageSize=10&keyword=refund" $viewerRegister.data.token
Write-Pass "Conversation pagination search works" "total=$($conversations.data.total)"

$audit = Invoke-Api "Get" "/api/admin/audit-logs?page=1&pageSize=10&keyword=$Timestamp" $adminToken
Write-Pass "ADMIN can query audit logs" "total=$($audit.data.total)"

$deleteDocumentResponse = Invoke-Api "Delete" "/api/documents/$documentId" $managerToken
Write-Pass "Document delete cleans related data" "documentId=$documentId"
$documentId = ""

$documentsAfterDelete = Invoke-Api "Get" "/api/knowledge-bases/$kbId/documents?page=1&pageSize=10" $managerToken
if ($documentsAfterDelete.data.total -ne 0) {
    throw "Document list should be empty after delete, total=$($documentsAfterDelete.data.total)"
}
Write-Pass "Document list is empty after delete"

if (-not $KeepData) {
    Invoke-Api "Delete" "/api/knowledge-bases/$kbId" $managerToken | Out-Null
    Write-Pass "Cleanup knowledge base" "kbId=$kbId"
    $kbId = ""
}

Write-Host "E2E_SUMMARY kbId=$($kbResponse.data.id) taskId=$taskId manager=$managerEmail viewer=$viewerEmail editor=$editorEmail keepData=$KeepData"
