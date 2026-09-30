# Web Services & SOA Laboratory • Lab 8
## Kubernetes Orchestration, Basic CI/CD & Monitoring (Prometheus & Grafana)

**Course:** Web Services & SOA Laboratory  
**Lab Assignment:** Lab 8 – Kubernetes • GitHub Actions • Prometheus • Grafana  
**Project:** CampusConnect Microservices Platform  
**Namespace:** `lab8`  
**GitHub Repository:** [Campus-Connect](https://github.com/Vivek-26-12/Campus-Connect)  
**Starting Baseline:** Lab 7 API Gateway + User/Product/Order Microservices Application + MongoDB Atlas  

---

## 1. Application Overview & Starting Point

Building directly upon the **Lab 7** microservices architecture, this lab moves CampusConnect towards an industry-standard cloud-native DevOps workflow:
- **API Gateway (`api-gateway`):** Acts as the single external entry point, reverse-proxying requests to internal microservices, enforcing timeouts, and exposing Prometheus observability metrics at `/metrics`.
- **User Service (`user-service`):** Manages user profiles and student credentials on internal port `3001`.
- **Product Service (`product-service`):** Manages campus catalog items, pricing, and stock on internal port `3002`.
- **Order Service (`order-service`):** Manages purchase transactions on internal port `3003` with inter-service validation against User and Product services.
- **Database Layer (MongoDB Atlas):** Managed external cloud database cluster accessed via Kubernetes Secrets/ConfigMaps.
- **Orchestration (Kubernetes):** Declarative Pods, Deployments, Services, ConfigMaps, and Secrets in the dedicated `lab8` namespace.
- **Continuous Integration (GitHub Actions):** Automated CI pipeline running tests and building container images on push/PR.
- **Monitoring & Observability:** Prometheus scrapes gateway performance and HTTP metrics; Grafana renders live dashboards for traffic rates, error tracking, and latency percentiles.

---

## 2. Architecture & Service Discovery Topology

### 2.1 Communication Flow
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
|   |  - Exports Prometheus metrics at /metrics                                              |   |
|   +----------------------------------------------------------------------------------------+   |
|                 |                                   |                                |         |
|                 v                                   v                                v         |
|   +----------------------------+   +-------------------------------+   +-------------------+   |
|   | User Service               |   | Product Service               |   | Order Service     |   |
|   | svc: user-service:3001     |   | svc: product-service:3002     |   | svc: order-service|   |
|   | (Scaled to 3 Replicas)     |   |                               |   | :3003             |   |
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

### 2.2 Monitoring Topology
```
[Prometheus (svc: prometheus:9090)] ---> Scrapes http://api-gateway:3000/metrics (every 5s)
               ^
               |
[Grafana (svc: grafana:3000 / port 3005)] ---> Queries Prometheus for rate(http_requests_total[5m]), up, latencies
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
3. **Create the Lab 8 Namespace:**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   # or: kubectl create namespace lab8
   ```

---

## 4. Manifests & Deployment

The Kubernetes manifests are stored in [`k8s/`](./k8s/):

| File | Type | Purpose |
|---|---|---|
| `k8s/namespace.yaml` | Namespace | Creates dedicated `lab8` namespace |
| `k8s/configmap.yaml` | ConfigMap (`campus-config`) | Non-sensitive configs (ports, inter-service URLs, timeout) |
| `k8s/secret.yaml.example` | Secret (`campus-secrets`) | Secure template for MongoDB Atlas credentials |
| `k8s/gateway-deployment.yaml` | Deployment | API Gateway container specification & resource limits |
| `k8s/gateway-service.yaml` | Service | LoadBalancer / NodePort `30080` exposing gateway to host |
| `k8s/user-deployment.yaml` | Deployment | User microservice deployment |
| `k8s/user-service.yaml` | Service | ClusterIP `user-service:3001` internal stable endpoint |
| `k8s/product-deployment.yaml` | Deployment | Product microservice deployment |
| `k8s/product-service.yaml` | Service | ClusterIP `product-service:3002` internal stable endpoint |
| `k8s/order-deployment.yaml` | Deployment | Order microservice deployment |
| `k8s/order-service.yaml` | Service | ClusterIP `order-service:3003` internal stable endpoint |
| `k8s/monitoring/prometheus.yaml` | ConfigMap + Deploy + Svc | Prometheus scraper configured for `api-gateway:3000/metrics` |
| `k8s/monitoring/grafana.yaml` | ConfigMap + Deploy + Svc | Grafana with auto-provisioned Prometheus datasource |

### Deploy All Resources:
```bash
# 1. Build Docker images locally
powershell -File ./build-images.ps1

# 2. Apply all Kubernetes manifests
kubectl apply -f k8s/ -n lab8
kubectl apply -f k8s/monitoring/ -n lab8

# 3. Check status
kubectl get deployments -n lab8
kubectl get pods -n lab8
kubectl get services -n lab8
```

---

## 5. Gateway Access & Testing

Depending on your Kubernetes runtime:
- **Docker Desktop:** Gateway is reachable directly on `http://localhost:3000` (or `http://localhost:30080`).
- **Port Forwarding (Universal):**
  ```bash
  kubectl port-forward svc/api-gateway 3000:3000 -n lab8
  ```

### Verification Endpoints:
- `GET http://localhost:3000/health` $\rightarrow$ Returns gateway status `UP` and service discovery table.
- `GET http://localhost:3000/metrics` $\rightarrow$ Returns Prometheus metrics text format.
- `GET http://localhost:3000/users` $\rightarrow$ Fetches users through `user-service`.
- `GET http://localhost:3000/products` $\rightarrow$ Fetches products through `product-service`.
- `POST http://localhost:3000/orders` $\rightarrow$ Places order with payload `{"userId":101,"productId":501,"quantity":2}`.

---

## 6. Scaling & Self-Healing Demonstrations

### 6.1 Scaling the User Service
Scale `user-service` to 3 replicas:
```bash
kubectl scale deployment user-service --replicas=3 -n lab8
kubectl get pods -n lab8 -l app=user-service
```
*Observe that all 3 pods are Running and `user-service` ClusterIP balances traffic across them.*

### 6.2 Self-Healing
Delete any running `user-service` pod:
```bash
kubectl delete pod <user-service-pod-name> -n lab8
kubectl get pods -n lab8 -l app=user-service -w
```
*Kubernetes ReplicaSet detects desired count (3) > current count (2) and immediately instantiates a replacement pod.*

---

## 7. GitHub Actions CI/CD Pipeline

The workflow defined in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) triggers on `push` and `pull_request`:
1. **Checkout Code:** Uses `actions/checkout@v4`.
2. **Setup Node.js:** Node.js 20 environment with npm caching.
3. **Dependency Installation:** `npm ci` inside `api-gateway`, `user-service`, `product-service`, and `order-service`.
4. **Automated Testing:** Executes `npm test` across all services.
5. **Docker Container Builds:** Builds container images for all 4 microservices tagged with `${{ github.sha }}` and `v1`.

---

## 8. Prometheus & Grafana Monitoring

### 8.1 Prometheus Target Verification
- Prometheus UI: `http://localhost:9090` (or port-forward: `kubectl port-forward svc/prometheus 9090:9090 -n lab8`).
- Check Status $\rightarrow$ **Targets**: Confirm `api-gateway` reports state **UP (1/1)**.
- **PromQL Queries:**
  - `up{job="api-gateway"}` $\rightarrow$ Target availability (1 = UP).
  - `http_requests_total` $\rightarrow$ Cumulative requests processed by gateway.
  - `rate(http_requests_total[1m])` $\rightarrow$ Real-time request throughput per second.
  - `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` $\rightarrow$ 95th percentile latency.

### 8.2 Grafana Dashboard
- Grafana UI: `http://localhost:3005` (or `http://localhost:30030`, or port-forward: `kubectl port-forward svc/grafana 3000:3000 -n lab8`).
- Login: `admin` / `admin`.
- Dashboards Panels:
  1. **Gateway Availability (Stat Panel):** Query: `up{job="api-gateway"}`.
  2. **Total Request Traffic (Time Series Panel):** Query: `sum(rate(http_requests_total[1m])) by (route)`.
  3. **Error Status Breakdown (Bar/Pie Gauge):** Query: `sum by (status) (http_requests_total{status=~"4..|5.."})`.
  4. **Request Latency (Time Series):** Query: `rate(http_request_duration_seconds_sum[1m]) / rate(http_request_duration_seconds_count[1m])`.

### 8.3 Traffic Generation & Observation:
Run the included traffic generation script to immediately stimulate metrics:
```bash
node test_lab8.js
```
Observe immediate spikes in Grafana request-rate charts and Prometheus counters.

---

## 9. Troubleshooting & Diagnostics Commands

- Pod details & event failures:
  ```bash
  kubectl describe pod <pod-name> -n lab8
  ```
- Application runtime logs:
  ```bash
  kubectl logs <pod-name> -n lab8
  ```
- Service endpoints routing check:
  ```bash
  kubectl get endpoints -n lab8
  ```
