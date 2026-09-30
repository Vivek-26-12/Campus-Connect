# Start all CampusConnect Microservices locally in background / separate windows
Write-Host "Starting CampusConnect Microservices & API Gateway (Lab 7 with 5th Microservice)..." -ForegroundColor Cyan

# Environment variables for local direct port mapping
$env:PORT = "3000"
$env:GATEWAY_PORT = "3000"
$env:USER_SERVICE_PORT = "3001"
$env:PRODUCT_SERVICE_PORT = "3002"
$env:ORDER_SERVICE_PORT = "3003"
$env:DATA_SERVICE_PORT = "3004"
$env:USER_SERVICE_URL = "http://127.0.0.1:3001"
$env:PRODUCT_SERVICE_URL = "http://127.0.0.1:3002"
$env:ORDER_SERVICE_URL = "http://127.0.0.1:3003"
$env:DATA_SERVICE_URL = "http://127.0.0.1:3004"
$env:REQUEST_TIMEOUT_MS = "5000"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\user-service'; `$env:PORT=3001; `$env:USER_SERVICE_PORT=3001; node server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\product-service'; `$env:PORT=3002; `$env:PRODUCT_SERVICE_PORT=3002; node server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\order-service'; `$env:PORT=3003; `$env:ORDER_SERVICE_PORT=3003; `$env:USER_SERVICE_URL='http://127.0.0.1:3001'; `$env:PRODUCT_SERVICE_URL='http://127.0.0.1:3002'; node server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\data-service'; `$env:PORT=3004; `$env:DATA_SERVICE_PORT=3004; node server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\api-gateway'; `$env:PORT=3000; `$env:GATEWAY_PORT=3000; `$env:USER_SERVICE_URL='http://127.0.0.1:3001'; `$env:PRODUCT_SERVICE_URL='http://127.0.0.1:3002'; `$env:ORDER_SERVICE_URL='http://127.0.0.1:3003'; `$env:DATA_SERVICE_URL='http://127.0.0.1:3004'; node server.js"

Write-Host "All 5 microservices + API Gateway started! Gateway running at http://localhost:3000" -ForegroundColor Green
Write-Host "Run 'node test_gateway_lab7.js' to verify." -ForegroundColor Yellow
