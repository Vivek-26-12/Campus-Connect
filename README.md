# Web Services & SOA Laboratory • Lab 8
## Kubernetes Orchestration, Basic CI/CD & Monitoring (Prometheus & Grafana)

**Course:** Web Services & SOA Laboratory  
**Lab Assignment:** Lab 8 – Kubernetes • GitHub Actions CI/CD • Prometheus • Grafana  
**Project:** CampusConnect Microservices Platform  
**Student ID:** 202512045  
**Namespace:** `lab8`  
**GitHub Repository:** [Campus-Connect](https://github.com/Vivek-26-12/Campus-Connect)  
**Starting Baseline:** Lab 7 API Gateway + User/Product/Order Microservices Application + MongoDB Atlas  

---

## 1. Application Overview & Starting Point

Building directly upon the **Lab 7** microservices architecture, this lab transitions CampusConnect towards an enterprise-grade cloud-native DevOps workflow:
- **API Gateway (`api-gateway`):** Acts as the single external entry point, reverse-proxying requests to internal microservices, enforcing timeouts, and exposing Prometheus observability metrics at `/metrics`.
- **User Service (`user-service`):** Manages user profiles and student credentials on internal port `3001`.
- **Product Service (`product-service`):** Manages campus catalog items, pricing, and stock on internal port `3002`.
- **Order Service (`order-service`):** Manages purchase transactions on internal port `3003` with inter-service validation against User and Product services.
- **Database Layer (MongoDB Atlas):** Managed external cloud database cluster accessed securely via Kubernetes Secrets and ConfigMaps.
- **Orchestration (Kubernetes):** Declarative Pods, Deployments, Services, ConfigMaps, Secrets, Liveness/Readiness probes in the dedicated `lab8` namespace.
- **Continuous Integration & Delivery (GitHub Actions):** Automated CI/CD pipeline running tests, building versioned Docker images, pushing to GitHub Container Registry (GHCR), and staging Kubernetes rollouts.
- **Monitoring & Observability:** Prometheus continuously scrapes gateway performance and HTTP metrics; Grafana renders live dashboards for traffic throughput, error tracking, and latency percentiles.

---

## 2. Architecture & Service Discovery Topology

### 2.1 End-to-End Application Architecture
```
                           +-------------------------------------+
                           |      Client / Postman Traffic       |
                           +-------------------------------------+
                                              |
                                              | HTTP :3000 / NodePort 30080
                                              v
+------------------------------------------------------------------------------------------------+
| Kubernetes Cluster • Namespace: lab8                                                           |
|                                                                                                |
|   +----------------------------------------------------------------------------------------+   |
|   | API Gateway Deployment & Service (api-gateway:3000 / NodePort 30080)                   |   |
|   |  - Handles /users, /products, /orders                                                  |   |
|   |  - Health & Readiness Probes (/health)                                                 |   |
|   |  - Exports Prometheus metrics at /metrics                                              |   |
|   +----------------------------------------------------------------------------------------+   |
|                 |                                   |                                |         |
|                 v                                   v                                v         |
|   +----------------------------+   +-------------------------------+   +-------------------+   |
|   | User Service               |   | Product Service               |   | Order Service     |   |
|   | svc: user-service:3001     |   | svc: product-service:3002     |   | svc: order-service|   |
|   | (Scaled to 3 Replicas)     |   | (Liveness & Readiness Probes) |   | :3003             |   |
|   +----------------------------+   +-------------------------------+   +-------------------+   |
|                 \                                  /                             /             |
+------------------\--------------------------------/-----------------------------/--------------+
                    \                              /                             /
                     +----------------------------+-----------------------------+
                                                  | MONGODB_URI (Secret)
                                                  v
                               +-------------------------------------+
                               |     ☁️ MongoDB Atlas Cloud Cluster   |
                               +-------------------------------------+
```

### 2.2 Observability Architecture
```
[Prometheus (svc: prometheus:9090)] ---> Scrapes http://api-gateway:3000/metrics (every 3s-5s)
               ^
               |
[Grafana (svc: grafana:3000 / port 3005)] ---> Queries Prometheus for rate(http_requests_total[1m]), up, latencies
```

---

## 3. Kubernetes Prerequisites & Cluster Setup

1. **Verify Kubernetes Context:**
   ```bash
   kubectl config current-context
   ```
2. **Verify Cluster Nodes:**
   ```bash
   kubectl get nodes
   ```
3. **Create the Dedicated Lab 8 Namespace:**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   # or: kubectl create namespace lab8
   ```
4. **Inspect Active Namespace:**
   ```bash
   kubectl get namespaces
   ```

---

## 4. Manifests & Deployment

The declarative Kubernetes manifests are located in [`k8s/`](./k8s/):

| File | Type | Port | Purpose |
|---|---|---|---|
| `k8s/namespace.yaml` | Namespace | - | Defines isolated `lab8` namespace |
| `k8s/configmap.yaml` | ConfigMap (`campus-config`) | - | Non-sensitive configs (service URLs, ports, timeout) |
| `k8s/secret.yaml.example` | Secret (`campus-secrets`) | - | Secure template for MongoDB Atlas credentials |
| `k8s/gateway-deployment.yaml` | Deployment | 3000 | API Gateway pods with resource limits & probes |
| `k8s/gateway-service.yaml` | Service | 3000 / 30080 | LoadBalancer & NodePort 30080 exposing gateway |
| `k8s/user-deployment.yaml` | Deployment | 3001 | User microservice deployment with probes |
| `k8s/user-service.yaml` | Service | 3001 | ClusterIP `user-service` internal stable endpoint |
| `k8s/product-deployment.yaml` | Deployment | 3002 | Product microservice deployment with probes |
| `k8s/product-service.yaml` | Service | 3002 | ClusterIP `product-service` internal stable endpoint |
| `k8s/order-deployment.yaml` | Deployment | 3003 | Order microservice deployment with probes |
| `k8s/order-service.yaml` | Service | 3003 | ClusterIP `order-service` internal stable endpoint |
| `k8s/monitoring/prometheus.yaml` | ConfigMap + Deploy + Svc | 9090 / 30090 | Prometheus server scraping `api-gateway:3000/metrics` |
| `k8s/monitoring/grafana.yaml` | ConfigMap + Deploy + Svc | 3000 / 30030 | Grafana server with auto-provisioned Prometheus source |

### 4.1 Health & Readiness Probes (Section 3.3.1 Requirement)
Every microservice implements `/health` endpoints and is equipped with Kubernetes **liveness** and **readiness** probes:
- **Liveness Probe:** Detects deadlocks or hung processes and automatically restarts containers to restore service availability.
- **Readiness Probe:** Ensures Pods only receive incoming traffic once initialization and internal dependency connections are complete.

**Configuration Snippet (`k8s/gateway-deployment.yaml`):**
```yaml
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
```

### 4.2 Configuration & Service Discovery
- Microservices communicate strictly using internal Kubernetes Service DNS names (e.g. `http://user-service:3001`, `http://product-service:3002`, `http://order-service:3003`), avoiding hardcoded Pod IPs.
- Non-sensitive variables are managed in `campus-config` ConfigMap.
- Database connection strings are stored in `campus-secrets` Secret.

### 4.3 Applying Resources
```bash
# 1. Build local container images
powershell -File ./build-images.ps1

# 2. Apply all application and configuration manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml -n lab8
kubectl apply -f k8s/secret.yaml -n lab8
kubectl apply -f k8s/user-deployment.yaml -n lab8
kubectl apply -f k8s/user-service.yaml -n lab8
kubectl apply -f k8s/product-deployment.yaml -n lab8
kubectl apply -f k8s/product-service.yaml -n lab8
kubectl apply -f k8s/order-deployment.yaml -n lab8
kubectl apply -f k8s/order-service.yaml -n lab8
kubectl apply -f k8s/gateway-deployment.yaml -n lab8
kubectl apply -f k8s/gateway-service.yaml -n lab8

# 3. Apply monitoring manifests
kubectl apply -f k8s/monitoring/prometheus.yaml -n lab8
kubectl apply -f k8s/monitoring/grafana.yaml -n lab8

# Or execute the unified deployment script:
powershell -File ./deploy-k8s.ps1
```

### 4.4 Verify Deployment State
```bash
kubectl get deployments -n lab8
kubectl get pods -n lab8 -o wide
kubectl get services -n lab8
```

---

## 5. Gateway Access & Testing

Depending on the Kubernetes environment:
- **Docker Desktop / Local:** Gateway is exposed directly on port `3000` via LoadBalancer, or port `30080` via NodePort.
- **Port Forwarding (Universal fallback):**
  ```bash
  kubectl port-forward svc/api-gateway 3000:3000 -n lab8
  ```

### Verification Endpoints:
- `GET http://localhost:3000/health` $\rightarrow$ Returns gateway health `UP`, uptime, and service discovery table.
- `GET http://localhost:3000/metrics` $\rightarrow$ Returns Prometheus metric counters and duration histograms.
- `GET http://localhost:3000/services` $\rightarrow$ Lists dynamic service locations.
- `GET http://localhost:3000/users` $\rightarrow$ Fetches users via `user-service`.
- `GET http://localhost:3000/products` $\rightarrow$ Fetches products via `product-service`.
- `POST http://localhost:3000/orders` $\rightarrow$ Places order with payload `{"userId":101,"productId":501,"quantity":2}`.
- `GET http://localhost:30080/health` $\rightarrow$ Direct NodePort access verification.

---

## 6. Scaling & Self-Healing Demonstrations

### 6.1 Scaling the User Service
Scale `user-service` deployment from 1 replica to 3 replicas:
```bash
kubectl scale deployment user-service --replicas=3 -n lab8
kubectl get pods -n lab8 -l app=user-service
```
*Verification:* 3 distinct pods report status `Running` and `Ready (1/1)`. The ClusterIP Service `user-service:3001` automatically distributes incoming requests across all 3 backend replicas.

### 6.2 Self-Healing
Kubernetes continuously reconciles current state against desired state. To demonstrate self-healing:
1. List running User Service pods:
   ```bash
   kubectl get pods -n lab8 -l app=user-service
   ```
2. Manually delete one pod:
   ```bash
   kubectl delete pod <user-service-pod-name> -n lab8
   ```
3. Immediately observe replacement:
   ```bash
   kubectl get pods -n lab8 -l app=user-service -w
   ```
*Result:* The Kubernetes ReplicaSet detects the terminated pod and instantly spins up a fresh replacement pod, restoring the desired replica count of 3 with zero application downtime.

---

## 7. Troubleshooting & Diagnostics Commands

Use standard Kubernetes diagnostic tools for workload inspection:
- Inspect pod events, scheduling, and probe failures:
  ```bash
  kubectl describe pod <pod-name> -n lab8
  ```
- View live application container logs:
  ```bash
  kubectl logs <pod-name> -n lab8
  ```
- Verify service endpoints and target IP mapping:
  ```bash
  kubectl get endpoints -n lab8
  ```

---

## 8. GitHub Actions CI/CD Pipeline

The automated CI/CD pipeline is configured in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml):

### 8.1 Workflow Stages
1. **Trigger:** Fires on `push` and `pull_request` against `main` and `master` branches.
2. **Checkout:** Uses `actions/checkout@v4` to retrieve repository source.
3. **Environment Setup:** Configures Node.js 20 with npm package cache.
4. **Dependency Installation:** Runs `npm ci` across `api-gateway`, `user-service`, `product-service`, and `order-service`.
5. **Automated Testing:** Runs `npm test` across all four microservices.
6. **Container Build & Registry Delivery (GHCR):**
   - Logs in to GitHub Container Registry (`ghcr.io`) using `GITHUB_TOKEN`.
   - Builds Docker images for all four microservices.
   - Tags each image with:
     - Traceable Git Commit SHA: `ghcr.io/<owner>/<service>:${{ github.sha }}`
     - Semantic version: `ghcr.io/<owner>/<service>:v1`
     - Latest pointer: `ghcr.io/<owner>/<service>:latest`
   - Pushes versioned images to GHCR.
7. **Continuous Delivery / Rollout Validation:** Validates Kubernetes manifests dry-run and prepares rolling update.

### 8.2 Kubernetes Image Rollout Procedure
To perform zero-downtime rolling updates to a newly built versioned image from CI/CD:
```bash
kubectl set image deployment/api-gateway api-gateway=ghcr.io/<owner>/api-gateway:<commit-sha> -n lab8
kubectl rollout status deployment/api-gateway -n lab8
```

---

## 9. Prometheus & Grafana Monitoring

### 9.1 Prometheus Configuration & Scrape Verification
- Prometheus UI: `http://localhost:9090` (or `kubectl port-forward svc/prometheus 9090:9090 -n lab8`).
- Check **Status $\rightarrow$ Targets**: Confirm `api-gateway` reports state **UP (1/1)**.
- **Key PromQL Queries:**
  - `up{job="api-gateway"}` $\rightarrow$ Verifies gateway availability (1 = UP).
  - `http_requests_total` $\rightarrow$ Cumulative request count across methods and routes.
  - `rate(http_requests_total[1m])` $\rightarrow$ Real-time request throughput per second.
  - `sum by (status) (http_requests_total{status=~"[45].."})` $\rightarrow$ HTTP error rate breakdown.
  - `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` $\rightarrow$ 95th percentile latency.

### 9.2 Grafana Dashboard
- Grafana UI: `http://localhost:3005` (or NodePort `30030`, or `kubectl port-forward svc/grafana 3000:3000 -n lab8`).
- Credentials: `admin` / `admin`.
- Auto-provisioned datasource: `http://prometheus:9090`.
- Dashboard Model: Pre-packaged in [`monitoring/campusconnect-dashboard.json`](./monitoring/campusconnect-dashboard.json).
  1. **Gateway Availability (Stat Panel):** `up{job="api-gateway"}`
  2. **Total Request Traffic (Time Series):** `sum(rate(http_requests_total[1m])) by (route)`
  3. **HTTP Status Codes / Errors (Time Series Bars):** `sum by (status) (rate(http_requests_total[1m]))`
  4. **Latency Percentiles (Time Series):** `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`

### 9.3 Traffic Generation & Observation
Execute the automated test and traffic burst script:
```bash
node test_lab8.js
```
The script verifies all endpoints, sends 30 sample requests, generates controlled safe 404 error events, and triggers real-time updates in Grafana charts and Prometheus counters.

---

## 10. Required Evidence & Deliverables Matrix

| No. | Evidence Item | Description / Command | Output / Verification Reference |
|---|---|---|---|
| **1** | **Lab 7 Baseline** | Gateway request/response verification | `node test_gateway_lab7.js` (All 16 checks pass, HTTP 200/201) |
| **2** | **Kubernetes Environment** | Context and cluster nodes | `kubectl config current-context` & `kubectl get nodes` |
| **3** | **Manifests** | Gateway, services, config & secret YAML | Declarative YAML files in [`k8s/`](./k8s/) with probes & configs |
| **4** | **Deployment** | Pods, Deployments and Services in `lab8` | `kubectl get all -n lab8` showing all workloads `Running` & `Ready` |
| **5** | **Gateway Test** | Postman request through Kubernetes gateway | Postman requests to `/health`, `/users`, `/products`, `/orders` |
| **6** | **Scaling** | User Service scaled to 3 replicas | `kubectl scale deployment user-service --replicas=3 -n lab8` |
| **7** | **Self-Healing** | Deleted Pod followed by replacement | `kubectl delete pod <user-service-pod>` $\rightarrow$ ReplicaSet regenerates replacement |
| **8** | **Troubleshooting** | Diagnostics & inspection output | `kubectl describe pod`, `kubectl logs`, `kubectl get endpoints` |
| **9** | **GitHub Actions CI/CD** | Automated CI/CD workflow run | `.github/workflows/ci.yml` (Lint, test, build, GHCR delivery) |
| **10** | **Prometheus** | Target UP state & PromQL query | Prometheus Targets page `api-gateway (1/1 UP)` & PromQL `up` / `rate` |
| **11** | **Grafana** | Live monitoring dashboard | Grafana dashboard with Availability, Throughput, Error Rate & Latency |
| **12** | **Traffic** | Monitoring metrics after API traffic | Spike in request rate observed following `node test_lab8.js` execution |
| **13** | **Architecture** | End-to-end topology diagram | Architecture diagrams in Section 2 & [`architecture_diagram.svg`](./architecture_diagram.svg) |

---

## 11. Submission Checklist

- [x] Lab 7 application baseline verified.
- [x] Kubernetes context and node verified.
- [x] `lab8` namespace created and used.
- [x] Gateway/User/Product/Order Deployments and Services created.
- [x] ConfigMap and Secret used appropriately.
- [x] Health and readiness probes configured on all deployments.
- [x] Application deployed and verified in `lab8`.
- [x] Gateway tested from Postman and test scripts.
- [x] User Service scaled to 3 replicas.
- [x] Kubernetes self-healing demonstrated via pod deletion.
- [x] GitHub Actions CI/CD workflow created and validated.
- [x] Versioned Docker images tagged with Git SHA and pushed to registry.
- [x] Kubernetes rolling update procedure documented.
- [x] Prometheus targets and PromQL metrics verified.
- [x] Grafana dashboard created with all required panels.
- [x] API traffic generated and monitoring observation recorded.
- [x] README and Lab Report fully updated.
