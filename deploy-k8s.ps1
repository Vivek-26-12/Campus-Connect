# Deploy Lab 8 Microservices and Monitoring to Kubernetes
Write-Host "=== Deploying CampusConnect Microservices to Kubernetes (Namespace: lab8) ===" -ForegroundColor Cyan

# 1. Create namespace if not exists
Write-Host "`n1. Creating/Verifying namespace 'lab8'..." -ForegroundColor Yellow
kubectl apply -f k8s/namespace.yaml

# 2. Apply configmap & secret
Write-Host "`n2. Applying ConfigMap & Secret..." -ForegroundColor Yellow
kubectl apply -f k8s/configmap.yaml -n lab8
if (Test-Path "k8s/secret.yaml") {
    kubectl apply -f k8s/secret.yaml -n lab8
}

# 3. Apply Microservices Deployments & Services
Write-Host "`n3. Deploying Microservices (User, Product, Order, Gateway)..." -ForegroundColor Yellow
kubectl apply -f k8s/user-deployment.yaml -n lab8
kubectl apply -f k8s/user-service.yaml -n lab8
kubectl apply -f k8s/product-deployment.yaml -n lab8
kubectl apply -f k8s/product-service.yaml -n lab8
kubectl apply -f k8s/order-deployment.yaml -n lab8
kubectl apply -f k8s/order-service.yaml -n lab8
kubectl apply -f k8s/gateway-deployment.yaml -n lab8
kubectl apply -f k8s/gateway-service.yaml -n lab8

# 4. Deploy Monitoring (Prometheus & Grafana)
Write-Host "`n4. Deploying Prometheus & Grafana Monitoring..." -ForegroundColor Yellow
kubectl apply -f k8s/monitoring/prometheus.yaml -n lab8
kubectl apply -f k8s/monitoring/grafana.yaml -n lab8

Write-Host "`n=== Deployment Applied Successfully! ===" -ForegroundColor Green
Write-Host "Checking resource status in namespace 'lab8':"
kubectl get deployments -n lab8
kubectl get pods -n lab8
kubectl get services -n lab8
