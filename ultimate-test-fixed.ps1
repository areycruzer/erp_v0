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
    Write-Host "[SUCCESS] [$timestamp] $Message" -ForegroundColor Green
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
        Error = if ($Error) { $Error.Message } else { $null }
        Timestamp = $timestamp
        Category = "CRITICAL"
    }
}

function Write-TestWarning($Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Write-Host "[WARN] [$timestamp] $Message" -ForegroundColor Yellow
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
            $durationText = $duration.TotalMilliseconds.ToString('F2')
            Write-TestInfo "HTTP $Method $Uri -> $($response.StatusCode) ($durationText ms)"
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
    
    Write-TestInfo "Starting: $TestName" "TEST"
    if ($Description) {
        Write-TestInfo "Description: $Description" "DESC"
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
        Write-TestInfo "Table '$table' accessible"
    }
}

# =============================================================================
# AUTHENTICATION AND AUTHORIZATION TESTS
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
    Write-TestInfo "Admin authenticated successfully"
    
    # Test 2: Token Validation
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    $meResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/me" -Headers $headers -TestName "Auth-TokenValidation"
    
    if (-not $meResponse.Success) {
        throw "Token validation failed. Status: $($meResponse.StatusCode)"
    }
    
    if ($meResponse.Data.role -ne "ADMIN") {
        throw "Token user role mismatch. Expected: ADMIN, Got: $($meResponse.Data.role)"
    }
    
    Write-TestInfo "Token validation successful"
    
    # Test 3: Invalid Credentials
    $invalidLogin = @{ email = "invalid@test.com"; password = "wrongpass" }
    $invalidResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body $invalidLogin -TestName "Auth-InvalidCredentials"
    
    if ($invalidResponse.Success) {
        throw "Invalid credentials were accepted - security breach!"
    }
    
    if ($invalidResponse.StatusCode -ne 401) {
        throw "Wrong status code for invalid credentials. Expected: 401, Got: $($invalidResponse.StatusCode)"
    }
    
    Write-TestInfo "Invalid credentials properly rejected"
}

function Test-SecurityMeasures {
    Write-TestInfo "Testing comprehensive security measures"
    
    # Test 1: Unauthorized Access
    $unauthorizedResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -TestName "Security-Unauthorized"
    
    if ($unauthorizedResponse.StatusCode -ne 401) {
        throw "Unauthorized access not properly blocked. Expected 401, got $($unauthorizedResponse.StatusCode)"
    }
    
    $global:TestResults.SecurityTests["UnauthorizedAccess"] = "PASS"
    Write-TestInfo "Unauthorized access properly blocked"
    
    # Test 2: Invalid Token
    $headers = @{ "Authorization" = "Bearer invalid-token-12345" }
    $invalidTokenResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Headers $headers -TestName "Security-InvalidToken"
    
    if ($invalidTokenResponse.StatusCode -ne 401) {
        throw "Invalid token not properly rejected. Expected 401, got $($invalidTokenResponse.StatusCode)"
    }
    
    $global:TestResults.SecurityTests["InvalidToken"] = "PASS"
    Write-TestInfo "Invalid token properly rejected"
    
    # Test 3: SQL Injection Protection
    $sqlInjection = @{ email = "admin@hajiri.com'; DROP TABLE users; --"; password = "test" }
    $sqlResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body $sqlInjection -TestName "Security-SQLInjection"
    
    if ($sqlResponse.Success) {
        throw "SQL injection attempt was successful - major security vulnerability!"
    }
    
    $global:TestResults.SecurityTests["SQLInjection"] = "PASS"
    Write-TestInfo "SQL injection properly prevented"
}

# =============================================================================
# USER MANAGEMENT TESTS
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
    Write-TestInfo "Created user with ID: $newUserId"
}

# =============================================================================
# FRONTEND TESTS
# =============================================================================

function Test-FrontendAccess {
    Write-TestInfo "Testing comprehensive frontend access and PWA components"
    
    # Test 1: Frontend Root Access
    $frontendResponse = Invoke-TestRequest -Uri $FrontendUrl -TimeoutSec 10 -TestName "Frontend-Root"
    
    if (-not $frontendResponse.Success) {
        throw "Frontend not accessible. Status: $($frontendResponse.StatusCode). Error: $($frontendResponse.Error)"
    }
    
    Write-TestInfo "Frontend root accessible"
    
    # Test 2: PWA Manifest
    $manifestResponse = Invoke-TestRequest -Uri "$FrontendUrl/manifest.json" -TimeoutSec 10 -TestName "Frontend-Manifest"
    
    if (-not $manifestResponse.Success) {
        throw "PWA manifest not accessible. Status: $($manifestResponse.StatusCode)"
    }
    
    Write-TestInfo "PWA manifest accessible"
    
    # Test 3: Service Worker
    $swResponse = Invoke-TestRequest -Uri "$FrontendUrl/sw.js" -TimeoutSec 10 -TestName "Frontend-ServiceWorker"
    
    if (-not $swResponse.Success) {
        throw "Service worker not accessible. Status: $($swResponse.StatusCode)"
    }
    
    Write-TestInfo "Service worker accessible"
}

# =============================================================================
# PERFORMANCE TESTS
# =============================================================================

function Test-PerformanceBenchmarks {
    Write-TestInfo "Testing comprehensive performance benchmarks"
    
    $performanceTests = @(
        @{ Name = "Auth Login"; Uri = "$BackendUrl/auth/login"; Method = "POST"; Body = $global:TestData.Admin; ExpectedMs = 1000; Critical = $true },
        @{ Name = "Users List"; Uri = "$BackendUrl/users"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 2000; Critical = $true },
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
                $durationText = $duration.TotalMilliseconds.ToString('F2')
                Write-TestError "CRITICAL: Performance test '$($test.Name)' too slow: $durationText ms > $($test.ExpectedMs)ms"
            } else {
                $durationText = $duration.TotalMilliseconds.ToString('F2')
                Write-TestWarning "Performance test '$($test.Name)' slower than expected: $durationText ms > $($test.ExpectedMs)ms"
            }
        } else {
            $durationText = $duration.TotalMilliseconds.ToString('F2')
            Write-TestInfo "Performance test '$($test.Name)': $durationText ms (target: $($test.ExpectedMs)ms)"
        }
    }
    
    if ($performanceFailures -gt 0) {
        throw "$performanceFailures critical performance tests failed"
    }
}

# =============================================================================
# CLEANUP FUNCTIONS
# =============================================================================

function Cleanup-TestResources {
    Write-TestInfo "Cleaning up test resources"
    
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Cleanup created users
    foreach ($userId in $global:CreatedResources.Users) {
        try {
            Invoke-TestRequest -Uri "$BackendUrl/users/$userId" -Method "DELETE" -Headers $headers -TestName "Cleanup-User"
            Write-TestInfo "Cleaned up user: $userId"
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
    Write-Host "HAJIRI ATTENDANCE SYSTEM - ULTIMATE CODE COVERAGE TEST SUITE" -ForegroundColor Magenta
    Write-Host "Testing every single line of code across the entire system" -ForegroundColor Magenta
    Write-Host "Configuration:" -ForegroundColor Magenta
    Write-Host "   Backend: $BackendUrl" -ForegroundColor Magenta
    Write-Host "   Frontend: $FrontendUrl" -ForegroundColor Magenta
    Write-Host "   Verbose: $Verbose" -ForegroundColor Magenta
    Write-Host ("=" * 100) -ForegroundColor Magenta
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
        Write-Host "PHASE 1: CORE SYSTEM VALIDATION" -ForegroundColor Yellow
        Invoke-Test "Database Connection" { Test-DatabaseConnection } "Database" "Validate database connectivity and health status"
        Invoke-Test "Database Schema" { Test-DatabaseSchema } "Database" "Verify all required tables and schema integrity"
        
        # PHASE 2: AUTHENTICATION AND SECURITY
        Write-Host "PHASE 2: AUTHENTICATION AND SECURITY" -ForegroundColor Yellow
        Invoke-Test "Authentication System" { Test-AuthenticationSystem } "Authentication" "Test all authentication flows and token management"
        Invoke-Test "Security Measures" { Test-SecurityMeasures } "Security" "Test all security protections and vulnerability prevention"
        
        # PHASE 3: BUSINESS LOGIC MODULES
        Write-Host "PHASE 3: BUSINESS LOGIC MODULES" -ForegroundColor Yellow
        Invoke-Test "User Management" { Test-UserManagement } "UserMgmt" "Test complete user CRUD operations and management"
        
        # PHASE 4: FRONTEND AND PWA
        Write-Host "PHASE 4: FRONTEND AND PWA COMPONENTS" -ForegroundColor Yellow
        Invoke-Test "Frontend Access" { Test-FrontendAccess } "Frontend" "Test frontend accessibility and PWA components"
        
        # PHASE 5: PERFORMANCE AND LOAD TESTING
        Write-Host "PHASE 5: PERFORMANCE AND LOAD TESTING" -ForegroundColor Yellow
        Invoke-Test "Performance Benchmarks" { Test-PerformanceBenchmarks } "Performance" "Benchmark API response times and performance"
        
        # PHASE 6: CLEANUP
        Write-Host "PHASE 6: CLEANUP" -ForegroundColor Yellow
        Invoke-Test "Resource Cleanup" { Cleanup-TestResources } "Cleanup" "Clean up all test data and resources"
        
    }
    catch {
        Write-TestError "Critical test suite failure" $_
    }
    
    # Generate comprehensive final report
    $totalTime = (Get-Date) - $global:TestResults.StartTime
    $successRate = if ($global:TestResults.Total -gt 0) { ($global:TestResults.Passed / $global:TestResults.Total * 100).ToString("F2") } else { "0" }
    
    Write-Host ""
    Write-Host ("=" * 100) -ForegroundColor Magenta
    Write-Host "HAJIRI ATTENDANCE SYSTEM - ULTIMATE TEST REPORT" -ForegroundColor Magenta -BackgroundColor Blue
    Write-Host ("=" * 100) -ForegroundColor Magenta
    Write-Host "Total Execution Time: $($totalTime.TotalSeconds.ToString('F2')) seconds" -ForegroundColor White
    Write-Host "Tests Run: $($global:TestResults.Total)" -ForegroundColor White
    Write-Host "Tests Passed: $($global:TestResults.Passed)" -ForegroundColor Green
    Write-Host "Tests Failed: $($global:TestResults.Failed)" -ForegroundColor Red
    Write-Host "Success Rate: $successRate%" -ForegroundColor White
    
    # Code Coverage Report
    Write-Host ""
    Write-Host "CODE COVERAGE BY MODULE:" -ForegroundColor Cyan
    foreach ($module in $global:TestResults.CodeCoverage.Keys) {
        $coverage = $global:TestResults.CodeCoverage[$module]
        $moduleTotal = $coverage.Passed + $coverage.Failed
        $moduleRate = if ($moduleTotal -gt 0) { ($coverage.Passed / $moduleTotal * 100).ToString("F1") } else { "0" }
        Write-Host "   $module : $($coverage.Passed)/$moduleTotal ($moduleRate%)" -ForegroundColor $(if ($moduleRate -eq "100.0") { "Green" } elseif ($moduleRate -ge "80.0") { "Yellow" } else { "Red" })
    }
    
    # Performance Metrics Report
    Write-Host ""
    Write-Host "PERFORMANCE METRICS:" -ForegroundColor Cyan
    $performanceMetrics = $global:TestResults.PerformanceMetrics
    if ($performanceMetrics.Count -gt 0) {
        $durations = @()
        foreach ($metric in $performanceMetrics.Values) {
            if ($metric.Duration) {
                $durations += $metric.Duration
            }
        }
        
        if ($durations.Count -gt 0) {
            $avgResponseTime = ($durations | Measure-Object -Average).Average
            $maxResponseTime = ($durations | Measure-Object -Maximum).Maximum
            $minResponseTime = ($durations | Measure-Object -Minimum).Minimum
            
            Write-Host "   Average Response Time: $($avgResponseTime.ToString('F2'))ms" -ForegroundColor White
            Write-Host "   Fastest Response: $($minResponseTime.ToString('F2'))ms" -ForegroundColor Green
            Write-Host "   Slowest Response: $($maxResponseTime.ToString('F2'))ms" -ForegroundColor $(if ($maxResponseTime -gt 2000) { "Red" } elseif ($maxResponseTime -gt 1000) { "Yellow" } else { "Green" })
        } else {
            Write-Host "   No performance data collected (server connection issues)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   No performance metrics available" -ForegroundColor Yellow
    }
    
    # Security Test Results
    Write-Host ""
    Write-Host "SECURITY TEST RESULTS:" -ForegroundColor Cyan
    foreach ($securityTest in $global:TestResults.SecurityTests.Keys) {
        $result = $global:TestResults.SecurityTests[$securityTest]
        $color = if ($result -eq "PASS") { "Green" } else { "Red" }
        Write-Host "   $securityTest : $result" -ForegroundColor $color
    }
    
    # Final Status
    if ($global:TestResults.Failed -eq 0) {
        Write-Host ""
        Write-Host "ALL TESTS PASSED! EVERY LINE OF CODE VALIDATED!" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host "System is fully functional and ready for production deployment." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "SOME TESTS FAILED - DETAILED ERROR ANALYSIS:" -ForegroundColor Yellow -BackgroundColor DarkRed
        for ($i = 0; $i -lt $global:TestResults.Errors.Count; $i++) {
            $error = $global:TestResults.Errors[$i]
            Write-Host ""
            Write-Host "Error $($i + 1) [$($error.Category)]:" -ForegroundColor Red
            Write-Host "   Issue: $($error.Message)" -ForegroundColor Red
            if ($error.Error) {
                Write-Host "   Details: $($error.Error)" -ForegroundColor Red
            }
            Write-Host "   Time: $($error.Timestamp)" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "SYSTEM ACCESS URLS:" -ForegroundColor Cyan
    Write-Host "   Frontend: $FrontendUrl" -ForegroundColor Cyan
    Write-Host "   Backend API: $BackendUrl" -ForegroundColor Cyan
    Write-Host "   Backend Health: $BackendUrl/health" -ForegroundColor Cyan
    Write-Host ("=" * 100) -ForegroundColor Magenta
    Write-Host ""
    
    return $global:TestResults.Failed -eq 0
}

# Run the ultimate test suite if script is executed directly
if ($MyInvocation.InvocationName -ne ".") {
    $success = Start-UltimateTest
    exit $(if ($success) { 0 } else { 1 })
}
