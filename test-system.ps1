# Hajiri Attendance System - Comprehensive Test Script
# PowerShell script to test all functionality

param(
    [string]$BackendUrl = "http://localhost:3004/api",
    [string]$FrontendUrl = "http://localhost:3001",
    [switch]$Verbose = $false
)

# Initialize test results
$global:TestResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    Errors = @()
    StartTime = Get-Date
}

# Logging functions
function Write-TestInfo($Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "ℹ️  [$timestamp] [INFO] $Message" -ForegroundColor Cyan
}

function Write-TestSuccess($Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "✅ [$timestamp] [SUCCESS] $Message" -ForegroundColor Green
}

function Write-TestError($Message, $Error = $null) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "❌ [$timestamp] [ERROR] $Message" -ForegroundColor Red
    if ($Error) {
        Write-Host "   Details: $($Error.Message)" -ForegroundColor Red
        if ($Verbose) {
            Write-Host "   Stack: $($Error.ScriptStackTrace)" -ForegroundColor Red
        }
    }
    $global:TestResults.Errors += @{
        Message = $Message
        Error = $Error?.Message
        Timestamp = $timestamp
    }
}

function Write-TestWarning($Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "⚠️  [$timestamp] [WARN] $Message" -ForegroundColor Yellow
}

# HTTP request function
function Invoke-TestRequest {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int]$TimeoutSec = 30
    )
    
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
        
        $responseData = $null
        try {
            $responseData = $response.Content | ConvertFrom-Json
        } catch {
            $responseData = $response.Content
        }
        
        return @{
            StatusCode = $response.StatusCode
            Data = $responseData
            Success = $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
        }
    }
    catch {
        return @{
            StatusCode = $_.Exception.Response?.StatusCode?.value__ ?? 0
            Data = $null
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Test execution wrapper
function Invoke-Test {
    param(
        [string]$TestName,
        [scriptblock]$TestBlock
    )
    
    $global:TestResults.Total++
    $startTime = Get-Date
    
    Write-TestInfo "Starting test: $TestName"
    
    try {
        & $TestBlock
        $duration = (Get-Date) - $startTime
        $global:TestResults.Passed++
        Write-TestSuccess "Test passed: $TestName ($($duration.TotalMilliseconds.ToString('F2'))ms)"
    }
    catch {
        $duration = (Get-Date) - $startTime
        $global:TestResults.Failed++
        Write-TestError "Test failed: $TestName ($($duration.TotalMilliseconds.ToString('F2'))ms)" $_
    }
}

# Test data
$global:TestData = @{
    Admin = @{
        email = "admin@hajiri.com"
        password = "admin123"
        role = "ADMIN"
    }
}

$global:AuthTokens = @{}

# Test implementations
function Test-DatabaseConnection {
    $response = Invoke-TestRequest -Uri "$BackendUrl/health"
    
    if (-not $response.Success) {
        throw "Database health check failed. Status: $($response.StatusCode)"
    }
    
    if ($response.Data.database -ne "connected") {
        throw "Database not connected. Status: $($response.Data.database)"
    }
}

function Test-Authentication {
    # Test admin login
    $loginResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/login" -Method "POST" -Body $global:TestData.Admin
    
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
    
    # Test token validation
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    $meResponse = Invoke-TestRequest -Uri "$BackendUrl/auth/me" -Headers $headers
    
    if (-not $meResponse.Success) {
        throw "Token validation failed. Status: $($meResponse.StatusCode)"
    }
    
    if ($meResponse.Data.role -ne "ADMIN") {
        throw "Token user role mismatch. Expected: ADMIN, Got: $($meResponse.Data.role)"
    }
}

function Test-UserManagement {
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # List users
    $usersResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Headers $headers
    
    if (-not $usersResponse.Success) {
        throw "Users listing failed. Status: $($usersResponse.StatusCode)"
    }
    
    if (-not ($usersResponse.Data -is [Array])) {
        throw "Users response is not an array"
    }
    
    Write-TestInfo "Found $($usersResponse.Data.Count) users in the system"
}

function Test-SiteManagement {
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # List sites
    $sitesResponse = Invoke-TestRequest -Uri "$BackendUrl/sites" -Headers $headers
    
    if (-not $sitesResponse.Success) {
        throw "Sites listing failed. Status: $($sitesResponse.StatusCode)"
    }
    
    Write-TestInfo "Found $($sitesResponse.Data.Count) sites in the system"
}

function Test-WorkerManagement {
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # List workers
    $workersResponse = Invoke-TestRequest -Uri "$BackendUrl/workers" -Headers $headers
    
    if (-not $workersResponse.Success) {
        throw "Workers listing failed. Status: $($workersResponse.StatusCode)"
    }
    
    Write-TestInfo "Found $($workersResponse.Data.Count) workers in the system"
}

function Test-AttendanceSystem {
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # List attendance
    $attendanceResponse = Invoke-TestRequest -Uri "$BackendUrl/attendance" -Headers $headers
    
    if (-not $attendanceResponse.Success) {
        throw "Attendance listing failed. Status: $($attendanceResponse.StatusCode)"
    }
    
    Write-TestInfo "Found $($attendanceResponse.Data.Count) attendance records in the system"
}

function Test-AuditSystem {
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test audit logs
    $auditResponse = Invoke-TestRequest -Uri "$BackendUrl/audit/logs" -Headers $headers
    
    if (-not $auditResponse.Success) {
        throw "Audit logs failed. Status: $($auditResponse.StatusCode)"
    }
    
    # Test audit analytics
    $analyticsResponse = Invoke-TestRequest -Uri "$BackendUrl/audit/analytics" -Headers $headers
    
    if (-not $analyticsResponse.Success) {
        throw "Audit analytics failed. Status: $($analyticsResponse.StatusCode)"
    }
    
    Write-TestInfo "Audit system operational with $($auditResponse.Data.Count) log entries"
}

function Test-NotificationSystem {
    $headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }
    
    # Test notifications
    $notificationsResponse = Invoke-TestRequest -Uri "$BackendUrl/notifications" -Headers $headers
    
    if (-not $notificationsResponse.Success) {
        throw "Notifications failed. Status: $($notificationsResponse.StatusCode)"
    }
    
    Write-TestInfo "Notification system operational with $($notificationsResponse.Data.Count) notifications"
}

function Test-FrontendAccess {
    $frontendResponse = Invoke-TestRequest -Uri $FrontendUrl -TimeoutSec 10
    
    if (-not $frontendResponse.Success) {
        throw "Frontend not accessible. Status: $($frontendResponse.StatusCode). Error: $($frontendResponse.Error)"
    }
    
    # Test PWA manifest
    $manifestResponse = Invoke-TestRequest -Uri "$FrontendUrl/manifest.json" -TimeoutSec 10
    
    if (-not $manifestResponse.Success) {
        throw "PWA manifest not accessible. Status: $($manifestResponse.StatusCode)"
    }
    
    # Test service worker
    $swResponse = Invoke-TestRequest -Uri "$FrontendUrl/sw.js" -TimeoutSec 10
    
    if (-not $swResponse.Success) {
        throw "Service worker not accessible. Status: $($swResponse.StatusCode)"
    }
    
    Write-TestInfo "Frontend, PWA manifest, and service worker all accessible"
}

function Test-SecurityMeasures {
    # Test unauthorized access
    $unauthorizedResponse = Invoke-TestRequest -Uri "$BackendUrl/users"
    
    if ($unauthorizedResponse.StatusCode -ne 401) {
        throw "Unauthorized access not properly blocked. Expected 401, got $($unauthorizedResponse.StatusCode)"
    }
    
    # Test invalid token
    $headers = @{ "Authorization" = "Bearer invalid-token" }
    $invalidTokenResponse = Invoke-TestRequest -Uri "$BackendUrl/users" -Headers $headers
    
    if ($invalidTokenResponse.StatusCode -ne 401) {
        throw "Invalid token not properly rejected. Expected 401, got $($invalidTokenResponse.StatusCode)"
    }
    
    Write-TestInfo "Security measures working correctly"
}

function Test-PerformanceBenchmarks {
    $performanceTests = @(
        @{ Name = "Auth Login"; Uri = "$BackendUrl/auth/login"; Method = "POST"; Body = $global:TestData.Admin; ExpectedMs = 1000 },
        @{ Name = "Users List"; Uri = "$BackendUrl/users"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 2000 },
        @{ Name = "Sites List"; Uri = "$BackendUrl/sites"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 2000 },
        @{ Name = "Workers List"; Uri = "$BackendUrl/workers"; Method = "GET"; Headers = @{ "Authorization" = "Bearer $($global:AuthTokens.Admin)" }; ExpectedMs = 2000 }
    )
    
    foreach ($test in $performanceTests) {
        $startTime = Get-Date
        
        $params = @{
            Uri = $test.Uri
            Method = $test.Method
        }
        if ($test.Headers) { $params.Headers = $test.Headers }
        if ($test.Body) { $params.Body = $test.Body }
        
        $response = Invoke-TestRequest @params
        $duration = (Get-Date) - $startTime
        
        if (-not $response.Success) {
            throw "Performance test $($test.Name) failed with status $($response.StatusCode)"
        }
        
        if ($duration.TotalMilliseconds -gt $test.ExpectedMs) {
            Write-TestWarning "Performance test $($test.Name) slower than expected: $($duration.TotalMilliseconds.ToString('F2'))ms > $($test.ExpectedMs)ms"
        } else {
            Write-TestInfo "Performance test $($test.Name): $($duration.TotalMilliseconds.ToString('F2'))ms ✅"
        }
    }
}

# Main execution
function Start-ComprehensiveTest {
    Write-Host ""
    Write-Host "🚀 Starting Hajiri Attendance System Comprehensive Test Suite" -ForegroundColor Magenta
    Write-Host "📊 Configuration:" -ForegroundColor Magenta
    Write-Host "   Backend: $BackendUrl" -ForegroundColor Magenta
    Write-Host "   Frontend: $FrontendUrl" -ForegroundColor Magenta
    Write-Host "=" * 80 -ForegroundColor Magenta
    Write-Host ""
    
    # Reset test results
    $global:TestResults = @{
        Total = 0
        Passed = 0
        Failed = 0
        Errors = @()
        StartTime = Get-Date
    }
    
    try {
        # Core System Tests
        Invoke-Test "Database Connection" { Test-DatabaseConnection }
        Invoke-Test "Authentication System" { Test-Authentication }
        Invoke-Test "User Management" { Test-UserManagement }
        Invoke-Test "Site Management" { Test-SiteManagement }
        Invoke-Test "Worker Management" { Test-WorkerManagement }
        Invoke-Test "Attendance System" { Test-AttendanceSystem }
        
        # Advanced Feature Tests
        Invoke-Test "Audit System" { Test-AuditSystem }
        Invoke-Test "Notification System" { Test-NotificationSystem }
        Invoke-Test "Frontend Access" { Test-FrontendAccess }
        
        # Quality Tests
        Invoke-Test "Security Measures" { Test-SecurityMeasures }
        Invoke-Test "Performance Benchmarks" { Test-PerformanceBenchmarks }
        
    }
    catch {
        Write-TestError "Critical test failure" $_
    }
    
    # Generate final report
    $totalTime = (Get-Date) - $global:TestResults.StartTime
    $successRate = if ($global:TestResults.Total -gt 0) { ($global:TestResults.Passed / $global:TestResults.Total * 100).ToString("F2") } else { "0" }
    
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Magenta
    Write-Host "📋 HAJIRI ATTENDANCE SYSTEM - COMPREHENSIVE TEST REPORT" -ForegroundColor Magenta
    Write-Host "=" * 80 -ForegroundColor Magenta
    Write-Host "🕒 Total Execution Time: $($totalTime.TotalSeconds.ToString('F2')) seconds" -ForegroundColor White
    Write-Host "📊 Tests Run: $($global:TestResults.Total)" -ForegroundColor White
    Write-Host "✅ Tests Passed: $($global:TestResults.Passed)" -ForegroundColor Green
    Write-Host "❌ Tests Failed: $($global:TestResults.Failed)" -ForegroundColor Red
    Write-Host "📈 Success Rate: $successRate%" -ForegroundColor White
    
    if ($global:TestResults.Failed -eq 0) {
        Write-Host ""
        Write-Host "🎉 ALL TESTS PASSED! System is fully functional and ready for production." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️ Some tests failed. Review the errors:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $global:TestResults.Errors.Count; $i++) {
            $error = $global:TestResults.Errors[$i]
            Write-Host ""
            Write-Host "❌ Error $($i + 1): $($error.Message)" -ForegroundColor Red
            if ($error.Error) {
                Write-Host "   Details: $($error.Error)" -ForegroundColor Red
            }
            Write-Host "   Time: $($error.Timestamp)" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "🔗 System URLs:" -ForegroundColor Cyan
    Write-Host "   Frontend: $FrontendUrl" -ForegroundColor Cyan
    Write-Host "   Backend: $BackendUrl" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Magenta
    Write-Host ""
    
    # Save report to file
    $reportData = @{
        Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        Summary = @{
            Total = $global:TestResults.Total
            Passed = $global:TestResults.Passed
            Failed = $global:TestResults.Failed
            SuccessRate = [double]$successRate
            TotalTimeSeconds = $totalTime.TotalSeconds
        }
        Errors = $global:TestResults.Errors
        Configuration = @{
            BackendUrl = $BackendUrl
            FrontendUrl = $FrontendUrl
        }
    }
    
    $reportPath = Join-Path (Get-Location) "test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $reportData | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Host "📄 Detailed report saved to: $reportPath" -ForegroundColor Cyan
    
    return $global:TestResults.Failed -eq 0
}

# Run the test if script is executed directly
if ($MyInvocation.InvocationName -ne '.') {
    $success = Start-ComprehensiveTest
    exit $(if ($success) { 0 } else { 1 })
}
