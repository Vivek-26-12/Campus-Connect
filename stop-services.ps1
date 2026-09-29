# Stop standalone node microservices processes
Write-Host "Stopping all local Node.js microservice processes..." -ForegroundColor Cyan

Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*node.exe*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "All standalone Node microservices stopped." -ForegroundColor Green
