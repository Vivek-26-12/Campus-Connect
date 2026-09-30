# Build Docker images for Lab 8
Write-Host "=== Building Docker Images for Lab 8 Microservices ===" -ForegroundColor Cyan

Write-Host "1. Building api-gateway:v1..." -ForegroundColor Yellow
docker build -t api-gateway:v1 -t api-gateway:latest ./api-gateway

Write-Host "2. Building user-service:v1..." -ForegroundColor Yellow
docker build -t user-service:v1 -t user-service:latest ./user-service

Write-Host "3. Building product-service:v1..." -ForegroundColor Yellow
docker build -t product-service:v1 -t product-service:latest ./product-service

Write-Host "4. Building order-service:v1..." -ForegroundColor Yellow
docker build -t order-service:v1 -t order-service:latest ./order-service

Write-Host "`nAll Docker images built successfully!" -ForegroundColor Green
docker images | Select-String "api-gateway|user-service|product-service|order-service"
