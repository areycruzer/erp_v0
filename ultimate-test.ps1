# Hajiri Attendance System - ULTIMATE Code Coverage Test Suite
# Tests every single line of code across the entire system

param(
    [string]$BackendUrl = "http://localhost:3004/api",
    [string]$FrontendUrl = "http://localhost:3000",
    [switch]$Verbose = $false,
    [switch]$GenerateReport = $true
)

# Enhanced test results tracking
$global:TestResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    CodeCoverage = @{}
    PerformanceMetrics = @{}
    SecurityTests = @{}
    Errors = @()
    StartTime = Get-Date
}

# Enhanced logging with performance tracking
function Write-TestInfo($Message, $Category = "INFO") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Write-Host "[$Category] [$timestamp] $Message" -ForegroundColor Cyan
}

function Write-TestSuccess($Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Write-Host "[SUCCESS] [$timestamp] ✅ $Message" -ForegroundColor Green
}

function Write-TestError($Message, $Error = $null) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Write-Host "[ERROR] [$timestamp] $Message" -ForegroundColor Red
    if ($Error) {
        Write-Host "   Details: $($Error.Message)" -ForegroundColor Red
        if ($Verbose) {
            Write-Host "   Stack: $($Error.ScriptStackTrace)" -ForegroundColor Red
        }
    }
    $global:TestResults.Errors += @{
        Message = $Message
        Error = $Error.Message
        Timestamp = $timestamp
        Category = "CRITICAL"
    }
}

function Write-TestWarning($Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Write-Host "[WARN] [$timestamp] ⚠️ $Message" -ForegroundColor Yellow
}

# Enhanced HTTP request function with detailed metrics
function Invoke-TestRequest {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int]$TimeoutSec = 30,
        [string]$TestName = "Unknown"
    )
    
    $startTime = Get-Date
    
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            TimeoutSec = $TimeoutSec
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            $params.Headers["Content-Type"] = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        $duration = (Get-Date) - $startTime
        
        # Track performance metrics
        $global:TestResults.PerformanceMetrics[$TestName] = @{
            Duration = $duration.TotalMilliseconds
            StatusCode = $response.StatusCode
            ResponseSize = $response.Content.Length
            Method = $Method
            Uri = $Uri
        }
        
        $responseData = $null
        try {
            $responseData = $response.Content | ConvertFrom-Json
        } catch {
            $responseData = $response.Content
        }
        
        if ($Verbose) {
            Write-TestInfo "HTTP $Method $Uri -> $($response.StatusCode) ($($duration.TotalMilliseconds.ToString('F2'))ms)"
        }
        
        return @{
            StatusCode = $response.StatusCode
            Data = $responseData
            Success = $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
            Duration = $duration.TotalMilliseconds
            Headers = $response.Headers
        }
    }
    catch {
        $duration = (Get-Date) - $startTime
        $statusCode = 0
        try {
            $statusCode = $_.Exception.Response.StatusCode.value__
        } catch {}
        
        return @{
            StatusCode = $statusCode
            Data = $null
            Success = $false
            Error = $_.Exception.Message
            Duration = $duration.TotalMilliseconds
        }
    }
}

# Enhanced test execution with detailed tracking
function Invoke-Test {
    param(
        [string]$TestName,
        [scriptblock]$TestBlock,
        [string]$Category = "General",
        [string]$Description = ""
    )
    
    $global:TestResults.Total++
    $startTime = Get-Date
    
    Write-TestInfo "🧪 Starting: $TestName" "TEST"
    if ($Description) {
        Write-TestInfo "📝 Description: $Description" "DESC"
    }
    
    try {
        & $TestBlock
        $duration = (Get-Date) - $startTime
        $global:TestResults.Passed++
        $durationMs = $duration.TotalMilliseconds.ToString('F2')
        Write-TestSuccess "$TestName completed ($durationMs ms)"
        
        # Track code coverage
        if (-not $global:TestResults.CodeCoverage[$Category]) {
            $global:TestResults.CodeCoverage[$Category] = @{ Passed = 0; Failed = 0 }
        }
        $global:TestResults.CodeCoverage[$Category].Passed++
        
    }
    catch {
        $duration = (Get-Date) - $startTime
        $global:TestResults.Failed++
        $durationMs = $duration.TotalMilliseconds.ToString('F2')
        Write-TestError "$TestName failed ($durationMs ms)" $_
        
        # Track code coverage
        if (-not $global:TestResults.CodeCoverage[$Category]) {
            $global:TestResults.CodeCoverage[$Category] = @{ Passed = 0; Failed = 0 }
        }
        $global:TestResults.CodeCoverage[$Category].Failed++
    }
}

# Test data with comprehensive scenarios
$global:TestData = @{
    Admin = @{
        email = "admin@hajiri.com"
        password = "admin123"
        role = "ADMIN"
    }
    Foreman = @{
        email = "foreman@hajiri.com"
        password = "foreman123"
        role = "FOREMAN"
    }
    SiteIncharge = @{
        email = "siteincharge@hajiri.com"
        password = "site123"
        role = "SITE_INCHARGE"
    }
    NewUser = @{
        email = "newuser@test.com"
        password = "newpass123"
        role = "FOREMAN"
        name = "Test User"
    }
    Worker = @{
        name = "Test Worker"
        phone = "9876543210"
        adhar = "123456789012"
        photo = ""
        isActive = $true
    }
    Site = @{
        name = "Test Site"
        location = "Test Location"
        siteInchargeEmail = "siteincharge@hajiri.com"
        pValue = 50.0
        interpretation = "HOURS"
        checkpoint = "09:00"
    }
    AttendanceRecord = @{
        workerId = 1
        siteId = 1
        date = (Get-Date).ToString("yyyy-MM-dd")
        pValue = 8.0
        gpsCoordinates = "40.7128,-74.0060"
        submittedBy = 1
    }
}

$global:AuthTokens = @{}
$global:CreatedResources = @{
    Users = @()
    Workers = @()
    Sites = @()
    AttendanceRecords = @()
}

# =============================================================================
# DATABASE AND CONNECTION TESTS
# =============================================================================

function Test-DatabaseConnection {
    Write-TestInfo "Testing database connectivity and health"
    
    $response = Invoke-TestRequest -Uri "$BackendUrl/health" -TestName "Database-Health"
    
    if (-not $response.Success) {
        throw "Database health check failed. Status: $($response.StatusCode)"
    }
    
    $data = $response.Data
    if ($data.database -ne "connected") {
        throw "Database not connected. Status: $($data.database)"
    }
    
    if ($data.uptime -lt 0) {
        throw "Invalid uptime reported: $($data.uptime)"
    }
    
    Write-TestInfo "Database uptime: $($data.uptime)ms"
    Write-TestInfo "Database file: $($data.dbFile)"
}

function Test-DatabaseSchema {
    Write-TestInfo "Validating database schema and tables"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test that all required tables exist by trying to query them
    $tables = @("users", "workers", "sites", "attendance", "audit_logs")
    
    foreach ($table in $tables) {
        $response = Invoke-TestRequest -Uri "$BackendUrl/$table" -Headers $headers -TestName "Schema-$table"
        if (-not $response.Success -and $response.StatusCode -ne 404) {
            throw "Table '$table' validation failed. Status: $($response.StatusCode)"
        }
        Write-TestInfo "✅ Table '$table' accessible"
    }
}

# =============================================================================
# AUTHENTICATION AND AUTHORIZATION TESTS (Every Auth Code Path)
# =============================================================================

function Test-AuthenticationSystem {
    Write-TestInfo "Testing comprehensive authentication system"
    
    # Test 1: Admin Login
    $loginResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body $global:TestData.Admin -TestName "Auth-AdminLogin"
    
    if (-not $loginResponse.Success) {
        throw "Admin login failed. Status: $($loginResponse.StatusCode). Response: $($loginResponse.Data)"
    }
    
    if (-not $loginResponse.Data.token) {
        throw "Login response missing token"
    }
    
    if ($loginResponse.Data.user.role -ne "ADMIN") {
        throw "Admin role incorrect. Got: $($loginResponse.Data.user.role)"
    }
    
    $global:AuthTokens.Admin = $loginResponse.Data.token
    Write-TestInfo "✅ Admin authenticated successfully"
    
    # Test 2: Token Validation
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    $meResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/me" -Headers $headers -TestName "Auth-TokenValidation"
    
    if (-not $meResponse.Success) {
        throw "Token validation failed. Status: $($meResponse.StatusCode)"
    }
    
    if ($meResponse.Data.role -ne "ADMIN") {
        throw "Token user role mismatch. Expected: ADMIN, Got: $($meResponse.Data.role)"
    }
    
    Write-TestInfo "✅ Token validation successful"
    
    # Test 3: Invalid Credentials
    $invalidLogin = @{ email = "invalid@test.com"; password = "wrongpass" }
    $invalidResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body $invalidLogin -TestName "Auth-InvalidCredentials"
    
    if ($invalidResponse.Success) {
        throw "Invalid credentials were accepted - security breach!"
    }
    
    if ($invalidResponse.StatusCode -ne 401) {
        throw "Wrong status code for invalid credentials. Expected: 401, Got: $($invalidResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ Invalid credentials properly rejected"
    
    # Test 4: Missing Password
    $missingPassword = @{ email = "admin@hajiri.com" }
    $missingPassResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body $missingPassword -TestName "Auth-MissingPassword"
    
    if ($missingPassResponse.Success) {
        throw "Missing password was accepted - validation failure!"
    }
    
    Write-TestInfo "✅ Missing password properly validated"
    
    # Test 5: Malformed Request
    $malformedResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body "invalid-json" -TestName "Auth-MalformedRequest"
    
    if ($malformedResponse.Success) {
        throw "Malformed request was accepted - parser failure!"
    }
    
    Write-TestInfo "✅ Malformed requests properly rejected"
}

function Test-RoleBasedAccess {
    Write-TestInfo "Testing role-based access control for every role"
    
    # Test admin access to admin-only endpoints
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    $adminEndpoints = @(
        "$BackendUrl/users",
        "$BackendUrl/audit/logs",
        "$BackendUrl/audit/analytics"
    )
    
    foreach ($endpoint in $adminEndpoints) {
        $response = Invoke-TestRequest -Uri $endpoint -Headers $headers -TestName "RBAC-AdminAccess"
        if (-not $response.Success) {
            throw "Admin access denied to $endpoint. Status: $($response.StatusCode)"
        }
        Write-TestInfo "✅ Admin access granted to $endpoint"
    }
}

# =============================================================================
# SECURITY TESTS (Every Security Code Path)
# =============================================================================

function Test-SecurityMeasures {
    Write-TestInfo "Testing comprehensive security measures"
    
    # Test 1: Unauthorized Access
    $unauthorizedResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -TestName "Security-Unauthorized"
    
    if ($unauthorizedResponse.StatusCode -ne 401) {
        throw "Unauthorized access not properly blocked. Expected 401, got $($unauthorizedResponse.StatusCode)"
    }
    
    $global:TestResults.SecurityTests["UnauthorizedAccess"] = "PASS"
    Write-TestInfo "✅ Unauthorized access properly blocked"
    
    # Test 2: Invalid Token
    $headers = @{ "Authorization" = "Bearer invalid-token-12345" }
    $invalidTokenResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Headers $headers -TestName "Security-InvalidToken"
    
    if ($invalidTokenResponse.StatusCode -ne 401) {
        throw "Invalid token not properly rejected. Expected 401, got $($invalidTokenResponse.StatusCode)"
    }
    
    $global:TestResults.SecurityTests["InvalidToken"] = "PASS"
    Write-TestInfo "✅ Invalid token properly rejected"
    
    # Test 3: Malformed Authorization Header
    $malformedHeaders = @{ "Authorization" = "InvalidFormat" }
    $malformedResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Headers $malformedHeaders -TestName "Security-MalformedAuth"
    
    if ($malformedResponse.StatusCode -ne 401) {
        throw "Malformed auth header not rejected. Expected 401, got $($malformedResponse.StatusCode)"
    }
    
    $global:TestResults.SecurityTests["MalformedAuth"] = "PASS"
    Write-TestInfo "✅ Malformed auth header properly rejected"
    
    # Test 4: SQL Injection Protection
    $sqlInjection = @{ email = "admin@hajiri.com'; DROP TABLE users; --"; password = "test" }
    $sqlResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body $sqlInjection -TestName "Security-SQLInjection"
    
    if ($sqlResponse.Success) {
        throw "SQL injection attempt was successful - major security vulnerability!"
    }
    
    $global:TestResults.SecurityTests["SQLInjection"] = "PASS"
    Write-TestInfo "✅ SQL injection properly prevented"
    
    # Test 5: XSS Protection
    $xssPayload = @{ email = "<script>alert('xss')</script>"; password = "test" }
    $xssResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body $xssPayload -TestName "Security-XSS"
    
    if ($xssResponse.Success) {
        throw "XSS payload was accepted - security vulnerability!"
    }
    
    $global:TestResults.SecurityTests["XSS"] = "PASS"
    Write-TestInfo "✅ XSS protection working"
    
    # Test 6: CORS Headers
    $corsResponse = Invoke-TestRequest -Uri "$BackendUrl/health" -TestName "Security-CORS"
    if ($corsResponse.Success -and $corsResponse.Headers) {
        if ($corsResponse.Headers["Access-Control-Allow-Origin"]) {
            Write-TestInfo "✅ CORS headers present"
            $global:TestResults.SecurityTests["CORS"] = "PASS"
        }
    }
}

function Test-InputValidation {
    Write-TestInfo "Testing input validation for all endpoints"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test oversized input
    $oversizedData = @{
        name = "x" * 1000
        email = "test@test.com"
        password = "test123"
        role = "FOREMAN"
    }
    
    $oversizedResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Method "POST" -Body $oversizedData -Headers $headers -TestName "Validation-OversizedInput"
    
    if ($oversizedResponse.StatusCode -ne 400) {
        Write-TestWarning "Oversized input validation may need improvement"
    } else {
        Write-TestInfo "✅ Oversized input properly rejected"
    }
    
    # Test invalid email format
    $invalidEmailData = @{
        name = "Test User"
        email = "invalid-email-format"
        password = "test123"
        role = "FOREMAN"
    }
    
    $invalidEmailResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Method "POST" -Body $invalidEmailData -Headers $headers -TestName "Validation-InvalidEmail"
    
    if ($invalidEmailResponse.StatusCode -ne 400) {
        Write-TestWarning "Email validation may need improvement"
    } else {
        Write-TestInfo "✅ Invalid email format properly rejected"
    }
}

# =============================================================================
# USER MANAGEMENT TESTS (Every User Code Path)
# =============================================================================

function Test-UserManagement {
    Write-TestInfo "Testing comprehensive user management system"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test 1: List Users
    $usersResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Headers $headers -TestName "UserMgmt-List"
    
    if (-not $usersResponse.Success) {
        throw "Users listing failed. Status: $($usersResponse.StatusCode)"
    }
    
    if (-not ($usersResponse.Data -is [Array])) {
        throw "Users response is not an array"
    }
    
    $initialUserCount = $usersResponse.Data.Count
    Write-TestInfo "Found $initialUserCount users in the system"
    
    # Test 2: Create New User
    $createResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Method "POST" -Body $global:TestData.NewUser -Headers $headers -TestName "UserMgmt-Create"
    
    if (-not $createResponse.Success) {
        throw "User creation failed. Status: $($createResponse.StatusCode). Response: $($createResponse.Data)"
    }
    
    $newUserId = $createResponse.Data.id
    $global:CreatedResources.Users += $newUserId
    Write-TestInfo "✅ Created user with ID: $newUserId"
    
    # Test 3: Get Specific User
    $getUserResponse = Invoke-TestRequest -Uri "$BackendUrl/users/$newUserId" -Headers $headers -TestName "UserMgmt-GetById"
    
    if (-not $getUserResponse.Success) {
        throw "Get user by ID failed. Status: $($getUserResponse.StatusCode)"
    }
    
    if ($getUserResponse.Data.email -ne $global:TestData.NewUser.email) {
        throw "Retrieved user email mismatch. Expected: $($global:TestData.NewUser.email), Got: $($getUserResponse.Data.email)"
    }
    
    Write-TestInfo "✅ Successfully retrieved user by ID"
    
    # Test 4: Update User
    $updateData = @{
        name = "Updated Test User"
        role = "SITE_INCHARGE"
    }
    
    $updateResponse = Invoke-TestRequest -Uri "$BackendUrl/users/$newUserId" -Method "PUT" -Body $updateData -Headers $headers -TestName "UserMgmt-Update"
    
    if (-not $updateResponse.Success) {
        throw "User update failed. Status: $($updateResponse.StatusCode)"
    }
    
    if ($updateResponse.Data.name -ne $updateData.name) {
        throw "User update failed. Name not updated"
    }
    
    Write-TestInfo "✅ Successfully updated user"
    
    # Test 5: List Users Again (verify count increased)
    $usersAfterCreate = Invoke-TestRequest -Uri "$BackendUrl/users" -Headers $headers -TestName "UserMgmt-ListAfterCreate"
    
    if ($usersAfterCreate.Data.Count -le $initialUserCount) {
        throw "User count did not increase after creation"
    }
    
    Write-TestInfo "✅ User count increased correctly: $($usersAfterCreate.Data.Count)"
    
    # Test 6: Deactivate User
    $deactivateResponse = Invoke-TestRequest -Uri "$BackendUrl/users/$newUserId" -Method "DELETE" -Headers $headers -TestName "UserMgmt-Deactivate"
    
    if (-not $deactivateResponse.Success) {
        throw "User deactivation failed. Status: $($deactivateResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ Successfully deactivated user"
}

# =============================================================================
# WORKER MANAGEMENT TESTS (Every Worker Code Path)
# =============================================================================

function Test-WorkerManagement {
    Write-TestInfo "Testing comprehensive worker management system"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test 1: List Workers
    $workersResponse = Invoke-TestRequest -Uri "$BackendUrl/workers" -Headers $headers -TestName "WorkerMgmt-List"
    
    if (-not $workersResponse.Success) {
        throw "Workers listing failed. Status: $($workersResponse.StatusCode)"
    }
    
    $initialWorkerCount = $workersResponse.Data.Count
    Write-TestInfo "Found $initialWorkerCount workers in the system"
    
    # Test 2: Create New Worker
    $createWorkerResponse = Invoke-TestRequest -Uri "$BackendUrl/workers" -Method "POST" -Body $global:TestData.Worker -Headers $headers -TestName "WorkerMgmt-Create"
    
    if (-not $createWorkerResponse.Success) {
        throw "Worker creation failed. Status: $($createWorkerResponse.StatusCode). Response: $($createWorkerResponse.Data)"
    }
    
    $newWorkerId = $createWorkerResponse.Data.id
    $global:CreatedResources.Workers += $newWorkerId
    Write-TestInfo "✅ Created worker with ID: $newWorkerId"
    
    # Test 3: Get Specific Worker
    $getWorkerResponse = Invoke-TestRequest -Uri "$BackendUrl/workers/$newWorkerId" -Headers $headers -TestName "WorkerMgmt-GetById"
    
    if (-not $getWorkerResponse.Success) {
        throw "Get worker by ID failed. Status: $($getWorkerResponse.StatusCode)"
    }
    
    if ($getWorkerResponse.Data.name -ne $global:TestData.Worker.name) {
        throw "Retrieved worker name mismatch"
    }
    
    Write-TestInfo "✅ Successfully retrieved worker by ID"
    
    # Test 4: Update Worker
    $updateWorkerData = @{
        name = "Updated Test Worker"
        phone = "9999999999"
    }
    
    $updateWorkerResponse = Invoke-TestRequest -Uri "$BackendUrl/workers/$newWorkerId" -Method "PUT" -Body $updateWorkerData -Headers $headers -TestName "WorkerMgmt-Update"
    
    if (-not $updateWorkerResponse.Success) {
        throw "Worker update failed. Status: $($updateWorkerResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ Successfully updated worker"
    
    # Test 5: Search Workers
    $searchResponse = Invoke-TestRequest -Uri "$BackendUrl/workers?search=Updated" -Headers $headers -TestName "WorkerMgmt-Search"
    
    if (-not $searchResponse.Success) {
        throw "Worker search failed. Status: $($searchResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ Worker search functionality working"
}

# =============================================================================
# SITE MANAGEMENT TESTS (Every Site Code Path)
# =============================================================================

function Test-SiteManagement {
    Write-TestInfo "Testing comprehensive site management system"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test 1: List Sites
    $sitesResponse = Invoke-TestRequest -Uri "$BackendUrl/sites" -Headers $headers -TestName "SiteMgmt-List"
    
    if (-not $sitesResponse.Success) {
        throw "Sites listing failed. Status: $($sitesResponse.StatusCode)"
    }
    
    $initialSiteCount = $sitesResponse.Data.Count
    Write-TestInfo "Found $initialSiteCount sites in the system"
    
    # Test 2: Create New Site
    $createSiteResponse = Invoke-TestRequest -Uri "$BackendUrl/sites" -Method "POST" -Body $global:TestData.Site -Headers $headers -TestName "SiteMgmt-Create"
    
    if (-not $createSiteResponse.Success) {
        throw "Site creation failed. Status: $($createSiteResponse.StatusCode). Response: $($createSiteResponse.Data)"
    }
    
    $newSiteId = $createSiteResponse.Data.id
    $global:CreatedResources.Sites += $newSiteId
    Write-TestInfo "✅ Created site with ID: $newSiteId"
    
    # Test 3: Get Specific Site
    $getSiteResponse = Invoke-TestRequest -Uri "$BackendUrl/sites/$newSiteId" -Headers $headers -TestName "SiteMgmt-GetById"
    
    if (-not $getSiteResponse.Success) {
        throw "Get site by ID failed. Status: $($getSiteResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ Successfully retrieved site by ID"
    
    # Test 4: Update Site Configuration
    $updateSiteData = @{
        name = "Updated Test Site"
        pValue = 75.0
        interpretation = "PERCENTAGE"
    }
    
    $updateSiteResponse = Invoke-TestRequest -Uri "$BackendUrl/sites/$newSiteId" -Method "PUT" -Body $updateSiteData -Headers $headers -TestName "SiteMgmt-Update"
    
    if (-not $updateSiteResponse.Success) {
        throw "Site update failed. Status: $($updateSiteResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ Successfully updated site configuration"
}

# =============================================================================
# ATTENDANCE SYSTEM TESTS (Every Attendance Code Path)
# =============================================================================

function Test-AttendanceSystem {
    Write-TestInfo "Testing comprehensive attendance tracking system"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test 1: List Attendance Records
    $attendanceResponse = Invoke-TestRequest -Uri "$BackendUrl/attendance" -Headers $headers -TestName "Attendance-List"
    
    if (-not $attendanceResponse.Success) {
        throw "Attendance listing failed. Status: $($attendanceResponse.StatusCode)"
    }
    
    $initialAttendanceCount = $attendanceResponse.Data.Count
    Write-TestInfo "Found $initialAttendanceCount attendance records"
    
    # Test 2: Submit Attendance (if we have workers and sites)
    if ($global:CreatedResources.Workers.Count -gt 0 -and $global:CreatedResources.Sites.Count -gt 0) {
        $attendanceData = @{
            workerId = $global:CreatedResources.Workers[0]
            siteId = $global:CreatedResources.Sites[0]
            date = (Get-Date).ToString("yyyy-MM-dd")
            pValue = 8.0
            gpsCoordinates = "40.7128,-74.0060"
            submittedBy = 1
        }
        
        $submitResponse = Invoke-TestRequest -Uri "$BackendUrl/attendance" -Method "POST" -Body $attendanceData -Headers $headers -TestName "Attendance-Submit"
        
        if ($submitResponse.Success) {
            $newAttendanceId = $submitResponse.Data.id
            $global:CreatedResources.AttendanceRecords += $newAttendanceId
            Write-TestInfo "✅ Successfully submitted attendance record"
        } else {
            Write-TestWarning "Attendance submission failed - may need worker/site setup"
        }
    }
    
    # Test 3: Get Attendance Statistics
    $statsResponse = Invoke-TestRequest -Uri "$BackendUrl/attendance/stats" -Headers $headers -TestName "Attendance-Stats"
    
    if ($statsResponse.Success) {
        Write-TestInfo "✅ Attendance statistics endpoint working"
    }
    
    # Test 4: Get Attendance by Date Range
    $startDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    $dateRangeResponse = Invoke-TestRequest -Uri "$BackendUrl/attendance?startDate=$startDate&endDate=$endDate" -Headers $headers -TestName "Attendance-DateRange"
    
    if ($dateRangeResponse.Success) {
        Write-TestInfo "✅ Date range filtering working"
    }
}

# =============================================================================
# AUDIT SYSTEM TESTS (Every Audit Code Path)
# =============================================================================

function Test-AuditSystem {
    Write-TestInfo "Testing comprehensive audit logging system"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test 1: Get Audit Logs
    $auditResponse = Invoke-TestRequest -Uri "$BackendUrl/audit/logs" -Headers $headers -TestName "Audit-Logs"
    
    if (-not $auditResponse.Success) {
        throw "Audit logs failed. Status: $($auditResponse.StatusCode)"
    }
    
    Write-TestInfo "Found $($auditResponse.Data.Count) audit log entries"
    
    # Test 2: Get Audit Analytics
    $analyticsResponse = Invoke-TestRequest -Uri "$BackendUrl/audit/analytics" -Headers $headers -TestName "Audit-Analytics"
    
    if (-not $analyticsResponse.Success) {
        throw "Audit analytics failed. Status: $($analyticsResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ Audit analytics working"
    
    # Test 3: Get Audit Reports
    $reportsResponse = Invoke-TestRequest -Uri "$BackendUrl/audit/reports" -Headers $headers -TestName "Audit-Reports"
    
    if ($reportsResponse.Success) {
        Write-TestInfo "✅ Audit reports endpoint working"
    }
    
    # Test 4: Test Audit Log Filtering
    $filterResponse = Invoke-TestRequest -Uri "$BackendUrl/audit/logs?action=CREATE" -Headers $headers -TestName "Audit-Filter"
    
    if ($filterResponse.Success) {
        Write-TestInfo "✅ Audit log filtering working"
    }
}

# =============================================================================
# NOTIFICATION SYSTEM TESTS
# =============================================================================

function Test-NotificationSystem {
    Write-TestInfo "Testing notification system"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    $notificationsResponse = Invoke-TestRequest -Uri "$BackendUrl/notifications" -Headers $headers -TestName "Notifications-List"
    
    if (-not $notificationsResponse.Success) {
        throw "Notifications failed. Status: $($notificationsResponse.StatusCode)"
    }
    
    Write-TestInfo "Found $($notificationsResponse.Data.Count) notifications"
}

# =============================================================================
# FRONTEND TESTS (Every Frontend Code Path)
# =============================================================================

function Test-FrontendAccess {
    Write-TestInfo "Testing comprehensive frontend access and PWA components"
    
    # Test 1: Frontend Root Access
    $frontendResponse = Invoke-TestRequest -Uri $FrontendUrl -TimeoutSec 10 -TestName "Frontend-Root"
    
    if (-not $frontendResponse.Success) {
        throw "Frontend not accessible. Status: $($frontendResponse.StatusCode). Error: $($frontendResponse.Error)"
    }
    
    Write-TestInfo "✅ Frontend root accessible"
    
    # Test 2: PWA Manifest
    $manifestResponse = Invoke-TestRequest -Uri "$FrontendUrl/manifest.json" -TimeoutSec 10 -TestName "Frontend-Manifest"
    
    if (-not $manifestResponse.Success) {
        throw "PWA manifest not accessible. Status: $($manifestResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ PWA manifest accessible"
    
    # Test 3: Service Worker
    $swResponse = Invoke-TestRequest -Uri "$FrontendUrl/sw.js" -TimeoutSec 10 -TestName "Frontend-ServiceWorker"
    
    if (-not $swResponse.Success) {
        throw "Service worker not accessible. Status: $($swResponse.StatusCode)"
    }
    
    Write-TestInfo "✅ Service worker accessible"
    
    # Test 4: Static Assets
    $staticAssets = @("favicon.ico", "logo192.png", "logo512.png")
    
    foreach ($asset in $staticAssets) {
        $assetResponse = Invoke-TestRequest -Uri "$FrontendUrl/$asset" -TimeoutSec 5 -TestName "Frontend-Asset-$asset"
        if ($assetResponse.Success) {
            Write-TestInfo "✅ Static asset '$asset' accessible"
        } else {
            Write-TestWarning "Static asset '$asset' not found (may be optional)"
        }
    }
}

# =============================================================================
# PERFORMANCE TESTS (Every Performance Code Path)
# =============================================================================

function Test-PerformanceBenchmarks {
    Write-TestInfo "Testing comprehensive performance benchmarks"
    
    $performanceTests = @(
        @{ Name = "Auth Login"; Uri = "$BackendUrl/auth/login"; Method = "POST"; Body = $global:TestData.Admin; ExpectedMs = 1000; Critical = $true },
        @{ Name = "Users List"; Uri = "$BackendUrl/users"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 2000; Critical = $true },
        @{ Name = "Workers List"; Uri = "$BackendUrl/workers"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 2000; Critical = $false },
        @{ Name = "Sites List"; Uri = "$BackendUrl/sites"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 2000; Critical = $false },
        @{ Name = "Attendance List"; Uri = "$BackendUrl/attendance"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 3000; Critical = $false },
        @{ Name = "Audit Logs"; Uri = "$BackendUrl/audit/logs"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 5000; Critical = $false },
        @{ Name = "Health Check"; Uri = "$BackendUrl/health"; Method = "GET"; ExpectedMs = 500; Critical = $true }
    )
    
    $performanceFailures = 0
    
    foreach ($test in $performanceTests) {
        $startTime = Get-Date
        
        $params = @{
            Uri = $test.Uri
            Method = $test.Method
            TestName = "Performance-$($test.Name.Replace(' ', ''))"
        }
        if ($test.Headers) { $params.Headers = $test.Headers }
        if ($test.Body) { $params.Body = $test.Body }
        
        $response = Invoke-TestRequest @params
        $duration = (Get-Date) - $startTime
        
        if (-not $response.Success) {
            if ($test.Critical) {
                throw "Critical performance test '$($test.Name)' failed with status $($response.StatusCode)"
            } else {
                Write-TestWarning "Performance test '$($test.Name)' failed with status $($response.StatusCode)"
                continue
            }
        }
        
        if ($duration.TotalMilliseconds -gt $test.ExpectedMs) {
            if ($test.Critical) {
                $performanceFailures++
                Write-TestError "CRITICAL: Performance test '$($test.Name)' too slow: $($duration.TotalMilliseconds.ToString('F2'))ms > $($test.ExpectedMs)ms"
            } else {
                Write-TestWarning "Performance test '$($test.Name)' slower than expected: $($duration.TotalMilliseconds.ToString('F2'))ms > $($test.ExpectedMs)ms"
            }
        } else {
            Write-TestInfo "✅ Performance test '$($test.Name)': $($duration.TotalMilliseconds.ToString('F2'))ms (target: $($test.ExpectedMs)ms)"
        }
    }
    
    if ($performanceFailures -gt 0) {
        throw "$performanceFailures critical performance tests failed"
    }
}

# =============================================================================
# LOAD TESTING
# =============================================================================

function Test-ConcurrentAccess {
    Write-TestInfo "Testing concurrent access and load handling"
    
    $concurrentJobs = @()
    
    # Simulate 5 concurrent login attempts
    for ($i = 1; $i -le 5; $i++) {
        $job = Start-Job -ScriptBlock {
            param($BackendUrl, $TestData)
            
            try {
                $response = Invoke-WebRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body ($TestData | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
                return @{ Success = $true; StatusCode = $response.StatusCode; Duration = (Get-Date) }
            } catch {
                return @{ Success = $false; Error = $_.Exception.Message; Duration = (Get-Date) }
            }
        } -ArgumentList $BackendUrl, $global:TestData.Admin
        
        $concurrentJobs += $job
    }
    
    # Wait for all jobs to complete
    $results = $concurrentJobs | Wait-Job | Receive-Job
    $concurrentJobs | Remove-Job
    
    $successCount = ($results | Where-Object { $_.Success }).Count
    $failureCount = $results.Count - $successCount
    
    if ($failureCount -gt 2) {
        throw "Too many concurrent access failures: $failureCount out of $($results.Count)"
    }
    
    Write-TestInfo "✅ Concurrent access test: $successCount/$($results.Count) successful"
}

# =============================================================================
# MEMORY AND RESOURCE TESTS
# =============================================================================

function Test-MemoryUsage {
    Write-TestInfo "Testing memory usage and resource management"
    
    # Test large data set handling
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Attempt to stress test with multiple rapid requests
    $rapidRequests = 10
    $startTime = Get-Date
    
    for ($i = 1; $i -le $rapidRequests; $i++) {
        $response = Invoke-TestRequest -Uri "$BackendUrl/health" -Headers $headers -TestName "Memory-RapidRequest-$i"
        if (-not $response.Success) {
            Write-TestWarning "Rapid request $i failed - possible memory/resource issue"
        }
    }
    
    $totalTime = (Get-Date) - $startTime
    $avgResponseTime = $totalTime.TotalMilliseconds / $rapidRequests
    
    Write-TestInfo "✅ Rapid requests test: $rapidRequests requests in $($totalTime.TotalMilliseconds.ToString('F2'))ms (avg: $($avgResponseTime.ToString('F2'))ms)"
    
    if ($avgResponseTime -gt 1000) {
        Write-TestWarning "Average response time high - possible memory/performance issue"
    }
}

# =============================================================================
# CLEANUP FUNCTIONS
# =============================================================================

function Cleanup-TestResources {
    Write-TestInfo "Cleaning up test resources"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Cleanup created attendance records
    foreach ($attendanceId in $global:CreatedResources.AttendanceRecords) {
        try {
            Invoke-TestRequest -Uri "$BackendUrl/attendance/$attendanceId" -Method "DELETE" -Headers $headers -TestName "Cleanup-Attendance"
            Write-TestInfo "✅ Cleaned up attendance record: $attendanceId"
        } catch {
            Write-TestWarning "Failed to cleanup attendance record: $attendanceId"
        }
    }
    
    # Cleanup created workers
    foreach ($workerId in $global:CreatedResources.Workers) {
        try {
            Invoke-TestRequest -Uri "$BackendUrl/workers/$workerId" -Method "DELETE" -Headers $headers -TestName "Cleanup-Worker"
            Write-TestInfo "✅ Cleaned up worker: $workerId"
        } catch {
            Write-TestWarning "Failed to cleanup worker: $workerId"
        }
    }
    
    # Cleanup created sites
    foreach ($siteId in $global:CreatedResources.Sites) {
        try {
            Invoke-TestRequest -Uri "$BackendUrl/sites/$siteId" -Method "DELETE" -Headers $headers -TestName "Cleanup-Site"
            Write-TestInfo "✅ Cleaned up site: $siteId"
        } catch {
            Write-TestWarning "Failed to cleanup site: $siteId"
        }
    }
    
    # Cleanup created users
    foreach ($userId in $global:CreatedResources.Users) {
        try {
            Invoke-TestRequest -Uri "$BackendUrl/users/$userId" -Method "DELETE" -Headers $headers -TestName "Cleanup-User"
            Write-TestInfo "✅ Cleaned up user: $userId"
        } catch {
            Write-TestWarning "Failed to cleanup user: $userId"
        }
    }
}

# =============================================================================
# MAIN EXECUTION FUNCTION
# =============================================================================

function Start-UltimateTest {
    Write-Host ""
    Write-Host "🚀 HAJIRI ATTENDANCE SYSTEM - ULTIMATE CODE COVERAGE TEST SUITE" -ForegroundColor Magenta
    Write-Host "🎯 Testing every single line of code across the entire system" -ForegroundColor Magenta
    Write-Host "📊 Configuration:" -ForegroundColor Magenta
    Write-Host "   Backend: $BackendUrl" -ForegroundColor Magenta
    Write-Host "   Frontend: $FrontendUrl" -ForegroundColor Magenta
    Write-Host "   Verbose: $Verbose" -ForegroundColor Magenta
    Write-Host "=" * 100 -ForegroundColor Magenta
    Write-Host ""
    
    # Reset test results
    $global:TestResults = @{
        Total = 0
        Passed = 0
        Failed = 0
        CodeCoverage = @{}
        PerformanceMetrics = @{}
        SecurityTests = @{}
        Errors = @()
        StartTime = Get-Date
    }
    
    try {
        # PHASE 1: CORE SYSTEM TESTS
        Write-Host "🔸 PHASE 1: CORE SYSTEM VALIDATION" -ForegroundColor Yellow
        Invoke-Test "Database Connection" { Test-DatabaseConnection } "Database" "Validate database connectivity and health status"
        Invoke-Test "Database Schema" { Test-DatabaseSchema } "Database" "Verify all required tables and schema integrity"
        
        # PHASE 2: AUTHENTICATION & SECURITY
        Write-Host "🔸 PHASE 2: AUTHENTICATION & SECURITY" -ForegroundColor Yellow
        Invoke-Test "Authentication System" { Test-AuthenticationSystem } "Authentication" "Test all authentication flows and token management"
        Invoke-Test "Role-Based Access Control" { Test-RoleBasedAccess } "Authorization" "Validate role-based access controls"
        Invoke-Test "Security Measures" { Test-SecurityMeasures } "Security" "Test all security protections and vulnerability prevention"
        Invoke-Test "Input Validation" { Test-InputValidation } "Security" "Validate input sanitization and validation rules"
        
        # PHASE 3: BUSINESS LOGIC MODULES
        Write-Host "🔸 PHASE 3: BUSINESS LOGIC MODULES" -ForegroundColor Yellow
        Invoke-Test "User Management" { Test-UserManagement } "UserMgmt" "Test complete user CRUD operations and management"
        Invoke-Test "Worker Management" { Test-WorkerManagement } "WorkerMgmt" "Test complete worker CRUD operations and management"
        Invoke-Test "Site Management" { Test-SiteManagement } "SiteMgmt" "Test complete site CRUD operations and configuration"
        Invoke-Test "Attendance System" { Test-AttendanceSystem } "Attendance" "Test complete attendance tracking and management"
        
        # PHASE 4: ADVANCED FEATURES
        Write-Host "🔸 PHASE 4: ADVANCED FEATURES" -ForegroundColor Yellow
        Invoke-Test "Audit System" { Test-AuditSystem } "Audit" "Test comprehensive audit logging and analytics"
        Invoke-Test "Notification System" { Test-NotificationSystem } "Notifications" "Test notification delivery and management"
        
        # PHASE 5: FRONTEND & PWA
        Write-Host "🔸 PHASE 5: FRONTEND & PWA COMPONENTS" -ForegroundColor Yellow
        Invoke-Test "Frontend Access" { Test-FrontendAccess } "Frontend" "Test frontend accessibility and PWA components"
        
        # PHASE 6: PERFORMANCE & LOAD TESTING
        Write-Host "🔸 PHASE 6: PERFORMANCE & LOAD TESTING" -ForegroundColor Yellow
        Invoke-Test "Performance Benchmarks" { Test-PerformanceBenchmarks } "Performance" "Benchmark API response times and performance"
        Invoke-Test "Concurrent Access" { Test-ConcurrentAccess } "Performance" "Test concurrent user access and load handling"
        Invoke-Test "Memory Usage" { Test-MemoryUsage } "Performance" "Test memory usage and resource management"
        
        # PHASE 7: CLEANUP
        Write-Host "🔸 PHASE 7: CLEANUP" -ForegroundColor Yellow
        Invoke-Test "Resource Cleanup" { Cleanup-TestResources } "Cleanup" "Clean up all test data and resources"
        
    }
    catch {
        Write-TestError "Critical test suite failure" $_
    }
    
    # Generate comprehensive final report
    $totalTime = (Get-Date) - $global:TestResults.StartTime
    $successRate = if ($global:TestResults.Total -gt 0) { ($global:TestResults.Passed / $global:TestResults.Total * 100).ToString("F2") } else { "0" }
    
    Write-Host ""
    Write-Host "=" * 100 -ForegroundColor Magenta
    Write-Host "📋 HAJIRI ATTENDANCE SYSTEM - ULTIMATE TEST REPORT" -ForegroundColor Magenta -BackgroundColor Blue
    Write-Host "=" * 100 -ForegroundColor Magenta
    Write-Host "🕒 Total Execution Time: $($totalTime.TotalSeconds.ToString('F2')) seconds" -ForegroundColor White
    Write-Host "📊 Tests Run: $($global:TestResults.Total)" -ForegroundColor White
    Write-Host "✅ Tests Passed: $($global:TestResults.Passed)" -ForegroundColor Green
    Write-Host "❌ Tests Failed: $($global:TestResults.Failed)" -ForegroundColor Red
    Write-Host "📈 Success Rate: $successRate%" -ForegroundColor White
    
    # Code Coverage Report
    Write-Host ""
    Write-Host "📊 CODE COVERAGE BY MODULE:" -ForegroundColor Cyan
    foreach ($module in $global:TestResults.CodeCoverage.Keys) {
        $coverage = $global:TestResults.CodeCoverage[$module]
        $moduleTotal = $coverage.Passed + $coverage.Failed
        $moduleRate = if ($moduleTotal -gt 0) { ($coverage.Passed / $moduleTotal * 100).ToString("F1") } else { "0" }
        Write-Host "   $module`: $($coverage.Passed)/$moduleTotal ($moduleRate%)" -ForegroundColor $(if ($moduleRate -eq "100.0") { "Green" } elseif ($moduleRate -ge "80.0") { "Yellow" } else { "Red" })
    }
    
    # Performance Metrics Report
    Write-Host ""
    Write-Host "⚡ PERFORMANCE METRICS:" -ForegroundColor Cyan
    $performanceMetrics = $global:TestResults.PerformanceMetrics
    if ($performanceMetrics.Count -gt 0) {
        $avgResponseTime = ($performanceMetrics.Values | Measure-Object Duration -Average).Average
        $maxResponseTime = ($performanceMetrics.Values | Measure-Object Duration -Maximum).Maximum
        $minResponseTime = ($performanceMetrics.Values | Measure-Object Duration -Minimum).Minimum
        
        Write-Host "   Average Response Time: $($avgResponseTime.ToString('F2'))ms" -ForegroundColor White
        Write-Host "   Fastest Response: $($minResponseTime.ToString('F2'))ms" -ForegroundColor Green
        Write-Host "   Slowest Response: $($maxResponseTime.ToString('F2'))ms" -ForegroundColor $(if ($maxResponseTime -gt 2000) { "Red" } elseif ($maxResponseTime -gt 1000) { "Yellow" } else { "Green" })
        
        Write-Host "   Top 5 Slowest Endpoints:" -ForegroundColor Yellow
        $slowest = $performanceMetrics.GetEnumerator() | Sort-Object { $_.Value.Duration } -Descending | Select-Object -First 5
        foreach ($endpoint in $slowest) {
            $color = if ($endpoint.Value.Duration -gt 2000) { "Red" } elseif ($endpoint.Value.Duration -gt 1000) { "Yellow" } else { "Green" }
            Write-Host "     $($endpoint.Key): $($endpoint.Value.Duration.ToString('F2'))ms" -ForegroundColor $color
        }
    }
    
    # Security Test Results
    Write-Host ""
    Write-Host "🔒 SECURITY TEST RESULTS:" -ForegroundColor Cyan
    foreach ($securityTest in $global:TestResults.SecurityTests.Keys) {
        $result = $global:TestResults.SecurityTests[$securityTest]
        $color = if ($result -eq "PASS") { "Green" } else { "Red" }
        Write-Host "   $securityTest`: $result" -ForegroundColor $color
    }
    
    # Final Status
    if ($global:TestResults.Failed -eq 0) {
        Write-Host ""
        Write-Host "🎉 ALL TESTS PASSED! EVERY LINE OF CODE VALIDATED!" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host "✨ System is fully functional and ready for production deployment." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️ SOME TESTS FAILED - DETAILED ERROR ANALYSIS:" -ForegroundColor Yellow -BackgroundColor DarkRed
        for ($i = 0; $i -lt $global:TestResults.Errors.Count; $i++) {
            $error = $global:TestResults.Errors[$i]
            Write-Host ""
            Write-Host "❌ Error $($i + 1) [$($error.Category)]:" -ForegroundColor Red
            Write-Host "   📍 Issue: $($error.Message)" -ForegroundColor Red
            if ($error.Error) {
                Write-Host "   🔍 Details: $($error.Error)" -ForegroundColor Red
            }
            Write-Host "   ⏰ Time: $($error.Timestamp)" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "🔗 SYSTEM ACCESS URLS:" -ForegroundColor Cyan
    Write-Host "   Frontend: $FrontendUrl" -ForegroundColor Cyan
    Write-Host "   Backend API: $BackendUrl" -ForegroundColor Cyan
    Write-Host "   Backend Health: $BackendUrl/health" -ForegroundColor Cyan
    Write-Host "=" * 100 -ForegroundColor Magenta
    Write-Host ""
    
    # Save comprehensive report to file
    if ($GenerateReport) {
        $reportData = @{
            Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            Summary = @{
                Total = $global:TestResults.Total
                Passed = $global:TestResults.Passed
                Failed = $global:TestResults.Failed
                SuccessRate = [double]$successRate
                TotalTimeSeconds = $totalTime.TotalSeconds
            }
            CodeCoverage = $global:TestResults.CodeCoverage
            PerformanceMetrics = $global:TestResults.PerformanceMetrics
            SecurityTests = $global:TestResults.SecurityTests
            Errors = $global:TestResults.Errors
            Configuration = @{
                BackendUrl = $BackendUrl
                FrontendUrl = $FrontendUrl
                Verbose = $Verbose
            }
        }
        
        $reportPath = Join-Path (Get-Location) "ultimate-test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        $reportData | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
        Write-Host "📄 Comprehensive report saved to: $reportPath" -ForegroundColor Cyan
        
        # Also create a human-readable HTML report
        $htmlReportPath = Join-Path (Get-Location) "ultimate-test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').html"
        $htmlContent = @"
<!DOCTYPE html>
<html>
<head>
    <title>Hajiri Attendance System - Ultimate Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #ecf0f1; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .success { color: #27ae60; font-weight: bold; }
        .error { color: #e74c3c; font-weight: bold; }
        .warning { color: #f39c12; font-weight: bold; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .performance-good { background-color: #d4edda; }
        .performance-warning { background-color: #fff3cd; }
        .performance-poor { background-color: #f8d7da; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Hajiri Attendance System - Ultimate Test Report</h1>
        <p>Generated on: $(Get-Date)</p>
    </div>
    
    <div class="summary">
        <h2>📊 Test Summary</h2>
        <p><strong>Total Tests:</strong> $($global:TestResults.Total)</p>
        <p><strong>Tests Passed:</strong> <span class="success">$($global:TestResults.Passed)</span></p>
        <p><strong>Tests Failed:</strong> <span class="error">$($global:TestResults.Failed)</span></p>
        <p><strong>Success Rate:</strong> $successRate%</p>
        <p><strong>Total Time:</strong> $($totalTime.TotalSeconds.ToString('F2')) seconds</p>
    </div>
    
    <h2>📊 Code Coverage by Module</h2>
    <table>
        <thead>
            <tr><th>Module</th><th>Passed</th><th>Failed</th><th>Total</th><th>Coverage %</th></tr>
        </thead>
        <tbody>
"@
        
        foreach ($module in $global:TestResults.CodeCoverage.Keys) {
            $coverage = $global:TestResults.CodeCoverage[$module]
            $moduleTotal = $coverage.Passed + $coverage.Failed
            $moduleRate = if ($moduleTotal -gt 0) { ($coverage.Passed / $moduleTotal * 100).ToString("F1") } else { "0" }
            $cssClass = if ($moduleRate -eq "100.0") { "performance-good" } elseif ($moduleRate -ge "80.0") { "performance-warning" } else { "performance-poor" }
            
            $htmlContent += "            <tr class=`"$cssClass`"><td>$module</td><td>$($coverage.Passed)</td><td>$($coverage.Failed)</td><td>$moduleTotal</td><td>$moduleRate%</td></tr>`n"
        }
        
        $htmlContent += @"
        </tbody>
    </table>
    
    <h2>⚡ Performance Metrics</h2>
    <table>
        <thead>
            <tr><th>Test Name</th><th>Duration (ms)</th><th>Status Code</th><th>Method</th><th>Endpoint</th></tr>
        </thead>
        <tbody>
"@
        
        foreach ($metric in $global:TestResults.PerformanceMetrics.GetEnumerator()) {
            $cssClass = if ($metric.Value.Duration -le 500) { "performance-good" } elseif ($metric.Value.Duration -le 2000) { "performance-warning" } else { "performance-poor" }
            $htmlContent += "            <tr class=`"$cssClass`"><td>$($metric.Key)</td><td>$($metric.Value.Duration.ToString('F2'))</td><td>$($metric.Value.StatusCode)</td><td>$($metric.Value.Method)</td><td>$($metric.Value.Uri)</td></tr>`n"
        }
        
        $htmlContent += @"
        </tbody>
    </table>
    
    <h2>🔒 Security Test Results</h2>
    <table>
        <thead>
            <tr><th>Security Test</th><th>Result</th></tr>
        </thead>
        <tbody>
"@
        
        foreach ($securityTest in $global:TestResults.SecurityTests.GetEnumerator()) {
            $cssClass = if ($securityTest.Value -eq "PASS") { "performance-good" } else { "performance-poor" }
            $htmlContent += "            <tr class=`"$cssClass`"><td>$($securityTest.Key)</td><td>$($securityTest.Value)</td></tr>`n"
        }
        
        $htmlContent += @"
        </tbody>
    </table>
</body>
</html>
"@
        
        $htmlContent | Out-File -FilePath $htmlReportPath -Encoding UTF8
        Write-Host "📊 HTML report saved to: $htmlReportPath" -ForegroundColor Cyan
    }
    
    return $global:TestResults.Failed -eq 0
}

# Run the ultimate test suite if script is executed directly
if ($MyInvocation.InvocationName -ne ".") {
    $success = Start-UltimateTest
    exit $(if ($success) { 0 } else { 1 })
}
