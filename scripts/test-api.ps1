# Simple Test Script for AI Microservice
# Just test the main endpoints

$apiUrl = "http://localhost:3001"

Write-Host "Testing AI Microservice..." -ForegroundColor Green
Write-Host ""

try {
    # Test 1: Health check
    Write-Host "1. Health check..." -NoNewline
    $response = Invoke-WebRequest "$apiUrl/health" -Method GET
    Write-Host " OK" -ForegroundColor Green

    # Test 2: Get face shapes
    Write-Host "2. Get face shapes..." -NoNewline
    $response = Invoke-WebRequest "$apiUrl/api/face/shapes" -Method GET
    Write-Host " OK" -ForegroundColor Green

    # Test 3: Get recommendations for Oval face
    Write-Host "3. Get recommendations..." -NoNewline
    $body = @{ faceShape = "Oval" } | ConvertTo-Json
    $response = Invoke-WebRequest "$apiUrl/api/recommendations" -Method POST -Body $body -ContentType "application/json"
    Write-Host " OK" -ForegroundColor Green

    # Test 4: Chat endpoint
    Write-Host "4. Chat endpoint..." -NoNewline
    $body = @{ message = "What hairstyle suits me?" } | ConvertTo-Json
    $response = Invoke-WebRequest "$apiUrl/api/chat" -Method POST -Body $body -ContentType "application/json"
    Write-Host " OK" -ForegroundColor Green

    Write-Host ""
    Write-Host "All tests passed!" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
