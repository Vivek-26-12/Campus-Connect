# Web Services & SOA Laboratory — Lab 8 Report
# Kubernetes Orchestration, Basic CI/CD & Monitoring
## Complete Technical Report & Step-by-Step Screenshot Guide

---

**Student ID:** 202512045  
**Course:** Web Services & SOA Laboratory  
**Assignment:** Lab 8 – Kubernetes • GitHub Actions CI/CD • Prometheus • Grafana  
**Project:** CampusConnect Microservices Platform  
**Namespace:** `lab8`  
**GitHub Repository:** [Campus-Connect](https://github.com/Vivek-26-12/Campus-Connect)  
**Date:** October 30, 2026  

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Application Architecture & Topology](#1-application-architecture--topology)
3. [Quick Reference: 13 Required Screenshots & Deliverables](#2-quick-reference-13-required-screenshots--deliverables)
4. [Step-by-Step Instructions: How to Take Every Screenshot](#3-step-by-step-instructions-how-to-take-every-screenshot)
   - [Deliverable 1: Lab 7 Baseline Verification](#deliverable-1-lab-7-baseline-verification)
   - [Deliverable 2: Kubernetes Environment Verification](#deliverable-2-kubernetes-environment-verification)
   - [Deliverable 3: Kubernetes Manifests & Health/Readiness Probes](#deliverable-3-kubernetes-manifests--healthreadiness-probes)
   - [Deliverable 4: Application Deployment in `lab8` Namespace](#deliverable-4-application-deployment-in-lab8-namespace)
   - [Deliverable 5: Gateway Testing via Postman & Client](#deliverable-5-gateway-testing-via-postman--client)
   - [Deliverable 6: Scaling the User Service](#deliverable-6-scaling-the-user-service)
   - [Deliverable 7: Self-Healing Demonstration](#deliverable-7-self-healing-demonstration)
   - [Deliverable 8: Kubernetes Troubleshooting & Diagnostics](#deliverable-8-kubernetes-troubleshooting--diagnostics)
   - [Deliverable 9: GitHub Actions CI/CD Pipeline](#deliverable-9-github-actions-cicd-pipeline)
   - [Deliverable 10: Prometheus Metric Collection & PromQL](#deliverable-10-prometheus-metric-collection--promql)
   - [Deliverable 11: Grafana Visualization Dashboard](#deliverable-11-grafana-visualization-dashboard)
   - [Deliverable 12: Traffic Generation & Monitoring Observation](#deliverable-12-traffic-generation--monitoring-observation)
   - [Deliverable 13: Architecture & Container Registry Delivery](#deliverable-13-architecture--container-registry-delivery)
5. [Summary Checklist & Submission Instructions](#4-summary-checklist--submission-instructions)

---

## Executive Summary

This report documents the implementation and verification of **Lab 8: Kubernetes Orchestration, Basic CI/CD & Monitoring** for the **CampusConnect** microservices application. Building on the Lab 7 API Gateway and User/Product/Order microservices, the system was containerized, orchestrated using Kubernetes manifests with liveness/readiness probes, integrated into an automated GitHub Actions CI/CD workflow with GitHub Container Registry (GHCR) versioning, and monitored end-to-end using Prometheus metric scraping and Grafana visualization dashboards.

This document contains **explicit, step-by-step instructions on how to capture every required screenshot** across all 13 deliverables specified in the laboratory guidelines.

---

## 1. Application Architecture & Topology

### 1.1 Complete Architecture Flow
```
                           +-------------------------------------+
                           |      Client / Postman Requests      |
                           +-------------------------------------+
                                              |
                                              | HTTP Port 3000 / NodePort 30080
                                              v
+------------------------------------------------------------------------------------------------+
| Kubernetes Cluster • Namespace: lab8                                                           |
|                                                                                                |
|   +----------------------------------------------------------------------------------------+   |
|   | API Gateway Service & Deployment (api-gateway:3000 / NodePort 30080)                   |   |
|   |  - Handles /users, /products, /orders                                                  |   |
|   |  - Liveness & Readiness Probes (/health)                                               |   |
|   |  - Prometheus Metrics Exporter (/metrics)                                              |   |
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

### 1.2 Monitoring Data Flow
```
[Prometheus (svc: prometheus:9090)] ---> Scrapes http://api-gateway:3000/metrics (every 3s)
               ^
               |
[Grafana (svc: grafana:3000 / port 3005)] ---> PromQL Queries (Throughput, Latency, Errors, Availability)
```

---

## 2. Quick Reference: 13 Required Screenshots & Deliverables

As per Section 7.1 of the Lab 8 specifications, here is the complete checklist of deliverables and the exact evidence required for each:

| Deliverable ID | Evidence Item | Required Evidence Content | Recommended Filename |
|---|---|---|---|
| **D01** | Lab 7 Baseline | Terminal output of `test_gateway_lab7.js` (16/16 checks passing) | `01_lab7_baseline_test.png` |
| **D02** | Kubernetes Environment | Terminal showing `kubectl config current-context` & `kubectl get nodes` | `02_k8s_environment_context.png` |
| **D03** | Manifests & Probes | Code editor showing `k8s/` manifests and `livenessProbe`/`readinessProbe` | `03_k8s_manifests_probes.png` |
| **D04** | Deployment in `lab8` | `kubectl get all -n lab8` showing Deployments, Services, and Pods (1/1 Ready) | `04_k8s_deployments_pods_running.png` |
| **D05** | Gateway Postman Test | Postman window showing successful requests to `/health`, `/users`, `/orders` | `05_gateway_postman_orders.png` |
| **D06** | Scaling User Service | Terminal output of `kubectl scale` to 3 replicas and `kubectl get pods` (3 running) | `06_scaling_user_service_3_replicas.png` |
| **D07** | Self-Healing | Terminal output of `kubectl delete pod` followed by immediate replacement pod | `07_self_healing_pod_replacement.png` |
| **D08** | Troubleshooting Output | Terminal showing `kubectl describe pod`, `kubectl logs`, and `kubectl get endpoints` | `08_troubleshooting_describe_logs.png` |
| **D09** | GitHub Actions CI/CD | GitHub browser UI showing completed CI/CD run (test, build, GHCR delivery) | `09_github_actions_cicd_run.png` |
| **D10** | Prometheus Targets & Queries | Browser at `localhost:9090` showing Target state **UP (1/1)** and PromQL query graph | `10_prometheus_targets_promql.png` |
| **D11** | Grafana Dashboard | Browser at `localhost:3005` showing dashboard with Availability, Throughput, Errors | `11_grafana_dashboard_overview.png` |
| **D12** | API Traffic Generation | Side-by-side terminal running `node test_lab8.js` and Grafana showing traffic spike | `12_traffic_burst_grafana_spike.png` |
| **D13** | Architecture & Registry | Final architecture diagram + GitHub Container Registry (GHCR) versioned images | `13_architecture_ghcr_registry.png` |

---

## 3. Step-by-Step Instructions: How to Take Every Screenshot

> [!TIP]
> **Windows Screenshot Shortcut:** Press `Windows Key + Shift + S` to activate the Windows Snipping Tool. Select the rectangular snip mode, drag over the desired window/region, and save the image into your `Campus-Connect/ScreenShots/` folder.

---

### Deliverable 1: Lab 7 Baseline Verification
**Goal:** Prove that the Lab 7 API Gateway and microservice isolation were fully operational before migrating to Kubernetes.

#### Step-by-Step Instructions:
1. Open PowerShell and navigate to the project directory:
   ```powershell
   cd "d:\DA\WSSOA Lab\Campus-Connect"
   ```
2. Start the local Lab 7 background services if not already running:
   ```powershell
   powershell -File ./start-services.ps1
   ```
3. Run the automated Lab 7 test script:
   ```powershell
   node test_gateway_lab7.js
   ```
4. Observe the terminal output until you see:
   ```
   ============================================================
   LAB 7 TEST SUMMARY: Passed: 16 | Failed: 0
   >>> ALL LAB 7 GATEWAY & ISOLATION CHECKS PASSED SUCCESSFULLY! <<<
   ============================================================
   ```
5. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the terminal window clearly showing the header `node test_gateway_lab7.js`, the individual green `[PASS]` tags, and the final summary `Passed: 16 | Failed: 0`.
   - Save the screenshot as: `ScreenShots/01_lab7_baseline_test.png`.
   *(Existing reference: `ScreenShots/Screenshot 2026-09-29 004218.png`)*

---

### Deliverable 2: Kubernetes Environment Verification
**Goal:** Show the active Kubernetes cluster context, healthy cluster node(s), and the created `lab8` namespace.

#### Step-by-Step Instructions:
1. Ensure your Kubernetes cluster (Docker Desktop, Minikube, or cloud cluster) is running.
2. In PowerShell, execute the verification commands:
   ```powershell
   # 1. Show active context
   kubectl config current-context

   # 2. Show active nodes and status
   kubectl get nodes

   # 3. Create and verify the dedicated namespace
   kubectl create namespace lab8
   kubectl get namespaces | Select-String "lab8"
   ```
3. **Expected Terminal Output:**
   ```
   docker-desktop (or minikube / kind)
   NAME             STATUS   ROLES           AGE   VERSION
   docker-desktop   Ready    control-plane   14d   v1.36.1
   lab8             Active   2m
   ```
4. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the terminal region containing the commands `kubectl config current-context`, `kubectl get nodes`, and `kubectl get namespaces` with the `Ready` node and `Active` `lab8` namespace.
   - Save the screenshot as: `ScreenShots/02_k8s_environment_context.png`.

---

### Deliverable 3: Kubernetes Manifests & Health/Readiness Probes
**Goal:** Demonstrate declarative Kubernetes YAML manifests, specifically displaying the `livenessProbe` and `readinessProbe` configurations (Section 3.3.1 requirement).

#### Step-by-Step Instructions:
1. Open VS Code in the project folder:
   ```powershell
   code "d:\DA\WSSOA Lab\Campus-Connect"
   ```
2. In the VS Code file explorer, expand the `k8s/` folder:
   - `gateway-deployment.yaml`
   - `user-deployment.yaml`
   - `product-deployment.yaml`
   - `order-deployment.yaml`
   - `configmap.yaml`
   - `secret.yaml.example`
3. Open `k8s/gateway-deployment.yaml` and scroll to lines 63–79 where `livenessProbe` and `readinessProbe` are defined.
4. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the VS Code window showing the file explorer on the left (showing all `.yaml` files in `k8s/`) and the editor on the right with the probe block visible:
     ```yaml
     livenessProbe:
       httpGet:
         path: /health
         port: 3000
       initialDelaySeconds: 10
     readinessProbe:
       httpGet:
         path: /health
         port: 3000
       initialDelaySeconds: 5
     ```
   - Save the screenshot as: `ScreenShots/03_k8s_manifests_probes.png`.

---

### Deliverable 4: Application Deployment in `lab8` Namespace
**Goal:** Show that all Deployments, Services, and Pods in `lab8` have reached `Running` status and `1/1 Ready`.

#### Step-by-Step Instructions:
1. Apply all Kubernetes manifests to the cluster:
   ```powershell
   powershell -File ./deploy-k8s.ps1
   ```
2. Wait 15–30 seconds for the containers to pull and pass readiness checks.
3. Check the status of all resources in namespace `lab8`:
   ```powershell
   kubectl get all -n lab8
   ```
4. **Expected Output:**
   ```
   NAME                                   READY   STATUS    RESTARTS   AGE
   pod/api-gateway-7489569df9-abc12       1/1     Running   0          2m
   pod/user-service-6784d858cf-xyz34      1/1     Running   0          2m
   pod/product-service-58d844888-def56    1/1     Running   0          2m
   pod/order-service-7f45778dc6-ghi78     1/1     Running   0          2m
   pod/prometheus-667794dbf4-jkl90        1/1     Running   0          2m
   pod/grafana-765fbc6468-mno12           1/1     Running   0          2m

   NAME                      TYPE           CLUSTER-IP      PORT(S)
   service/api-gateway       LoadBalancer   10.101.120.45   3000:30080/TCP
   service/user-service      ClusterIP      10.102.140.21   3001/TCP
   service/product-service   ClusterIP      10.103.160.88   3002/TCP
   service/order-service     ClusterIP      10.104.180.92   3003/TCP
   service/prometheus        NodePort       10.105.200.11   9090:30090/TCP
   service/grafana           NodePort       10.106.220.15   3000:30030/TCP
   ```
5. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the full terminal output of `kubectl get all -n lab8` ensuring all pods show `1/1 Running`.
   - Save the screenshot as: `ScreenShots/04_k8s_deployments_pods_running.png`.

---

### Deliverable 5: Gateway Testing via Postman & Client
**Goal:** Demonstrate that external clients can interact with microservices through the API Gateway, receiving successful HTTP 200/201 responses.

#### Step-by-Step Instructions:
1. Open **Postman**.
2. Click **Import** and select:
   `Campus-Connect/CampusConnect_Lab8_K8s_Monitoring.postman_collection.json`.
3. Test 1: Gateway Health
   - Select `GET /health` (`http://localhost:3000/health`).
   - Click **Send**. Confirm `Status: 200 OK` and `"status": "UP"`.
4. Test 2: Microservice Order Placement
   - Select `POST /orders` (`http://localhost:3000/orders`).
   - Set Header: `Content-Type: application/json`.
   - Body (`raw` JSON):
     ```json
     {
       "userId": 101,
       "productId": 501,
       "quantity": 2
     }
     ```
   - Click **Send**. Confirm `Status: 201 Created` with order confirmation JSON.
5. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the Postman window showing the request URL (`http://localhost:3000/orders`), the JSON body, the `Status: 201 Created` green pill, and the JSON response payload.
   - Save the screenshot as: `ScreenShots/05_gateway_postman_orders.png`.
   *(Existing reference: `ScreenShots/Screenshot 2026-09-30 183233.png`)*

---

### Deliverable 6: Scaling the User Service
**Goal:** Demonstrate horizontal Pod scaling on Kubernetes by scaling `user-service` from 1 to 3 replicas.

#### Step-by-Step Instructions:
1. In PowerShell, scale the `user-service` deployment:
   ```powershell
   kubectl scale deployment user-service --replicas=3 -n lab8
   ```
2. Check the User Service pods immediately:
   ```powershell
   kubectl get pods -n lab8 -l app=user-service
   ```
3. **Expected Output:**
   ```
   NAME                            READY   STATUS    RESTARTS   AGE
   user-service-6784d858cf-4mpx2   1/1     Running   0          14s
   user-service-6784d858cf-89lkq   1/1     Running   0          14s
   user-service-6784d858cf-xyz34   1/1     Running   0          8m
   ```
4. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the terminal showing both the scale command `kubectl scale deployment user-service --replicas=3 -n lab8` and the output of `kubectl get pods` displaying 3 distinct pods in `Running` state.
   - Save the screenshot as: `ScreenShots/06_scaling_user_service_3_replicas.png`.

---

### Deliverable 7: Self-Healing Demonstration
**Goal:** Demonstrate Kubernetes self-healing by deleting a running Pod and watching the ReplicaSet automatically instantiate a replacement.

#### Step-by-Step Instructions:
1. List running User Service pods and copy one pod name:
   ```powershell
   kubectl get pods -n lab8 -l app=user-service
   ```
2. Delete that specific pod:
   ```powershell
   kubectl delete pod <user-service-pod-name> -n lab8
   ```
3. Immediately list the pods again to observe the replacement being spawned:
   ```powershell
   kubectl get pods -n lab8 -l app=user-service
   ```
4. **Expected Output:**
   ```
   pod "user-service-6784d858cf-4mpx2" deleted

   NAME                            READY   STATUS              RESTARTS   AGE
   user-service-6784d858cf-89lkq   1/1     Running             0          2m
   user-service-6784d858cf-xyz34   1/1     Running             0          9m
   user-service-6784d858cf-w7t9b   1/1     Running             0          4s
   ```
5. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the terminal output clearly showing the `kubectl delete pod` command, the `pod deleted` confirmation, and the subsequent `kubectl get pods` output showing the newly spawned replacement pod with age `~4s`.
   - Save the screenshot as: `ScreenShots/07_self_healing_pod_replacement.png`.

---

### Deliverable 8: Kubernetes Troubleshooting & Diagnostics
**Goal:** Showcase standard Kubernetes inspection and diagnostics commands (`describe`, `logs`, `endpoints`).

#### Step-by-Step Instructions:
1. In PowerShell, run the three essential diagnostic commands:
   ```powershell
   # 1. Describe pod to show events and probe status
   kubectl describe pod -l app=api-gateway -n lab8 | Select-String -Pattern "Events|Liveness|Readiness|State" -Context 0,3

   # 2. View recent runtime logs
   kubectl logs deployment/api-gateway -n lab8 --tail=10

   # 3. Check service endpoints mapping
   kubectl get endpoints -n lab8
   ```
2. **Expected Output:**
   - `describe` shows `Liveness: http-get http://:3000/health` and `Readiness: http-get http://:3000/health`.
   - `logs` shows incoming requests with routing and timing.
   - `endpoints` shows the internal IP list mapped to each service.
3. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the terminal showing the output of `kubectl describe`, `kubectl logs`, and `kubectl get endpoints -n lab8`.
   - Save the screenshot as: `ScreenShots/08_troubleshooting_describe_logs.png`.

---

### Deliverable 9: GitHub Actions CI/CD Pipeline
**Goal:** Show an automated, successful CI/CD pipeline execution that checks out code, runs tests, builds Docker containers, and pushes versioned images to GHCR.

#### Step-by-Step Instructions:
1. Commit and push changes to your GitHub repository:
   ```powershell
   git add .
   git commit -m "Configure Lab 8 Kubernetes, Probes, and CI/CD"
   git push origin main
   ```
2. Open your web browser and navigate to your repository's Actions tab:
   `https://github.com/Vivek-26-12/Campus-Connect/actions`
3. Click on the latest workflow run: **CI/CD Pipeline**.
4. Click on the job **Build, Test, Containerize & Delivery** to expand the individual steps:
   - `✓ Checkout Repository`
   - `✓ Setup Node.js Runtime`
   - `✓ Install Microservices Dependencies`
   - `✓ Run Microservices Tests`
   - `✓ Build & Tag Container - API Gateway`
   - `✓ Push Images to GitHub Container Registry`
   - `✓ Validate Kubernetes Manifests & Rollout Strategy`
5. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the browser window showing the green checkmark `Build, Test, Containerize & Delivery`, the commit SHA, and the expanded passing steps.
   - Save the screenshot as: `ScreenShots/09_github_actions_cicd_run.png`.

---

### Deliverable 10: Prometheus Metric Collection & PromQL
**Goal:** Confirm Prometheus is scraping `api-gateway` metrics and demonstrate operational PromQL metric queries.

#### Step-by-Step Instructions:
1. Open your browser and navigate to the Prometheus web UI:
   `http://localhost:9090` (or NodePort `http://localhost:30090`)
   *(If running in cluster without NodePort, run: `kubectl port-forward svc/prometheus 9090:9090 -n lab8`)*
2. Check Scrape Targets:
   - Click top menu: **Status $\rightarrow$ Targets**.
   - Verify `api-gateway` displays state **UP (1/1)** with endpoint `http://api-gateway:3000/metrics`.
3. Run PromQL Query:
   - Click **Graph** in the top navigation.
   - Enter the PromQL expression:
     ```promql
     rate(http_requests_total[1m])
     ```
   - Click **Execute** and switch to the **Graph** tab.
4. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the browser window showing the Prometheus UI, the `rate(http_requests_total[1m])` expression, and the rendered time-series curve.
   - Save the screenshot as: `ScreenShots/10_prometheus_targets_promql.png`.

---

### Deliverable 11: Grafana Visualization Dashboard
**Goal:** Display the pre-configured Grafana monitoring dashboard with availability, request rates, error tracking, and latency panels.

#### Step-by-Step Instructions:
1. Open your browser and navigate to Grafana:
   `http://localhost:3005` (or NodePort `http://localhost:30030`, or `kubectl port-forward svc/grafana 3000:3000 -n lab8`)
2. Log in with credentials:
   - Username: `admin`
   - Password: `admin`
3. In the left navigation, click **Dashboards** $\rightarrow$ **Import** and select:
   `Campus-Connect/monitoring/campusconnect-dashboard.json`.
4. Open the imported dashboard: **CampusConnect - Kubernetes & API Gateway Monitoring**.
5. Observe the 4 core monitoring sections:
   - **Gateway Availability:** Green `UP` stat badge.
   - **Total API Requests Processed:** Number of handled requests.
   - **Request Throughput by Route:** Line graph showing `/users`, `/products`, `/orders`.
   - **HTTP Status Code Breakdown & Latency Percentiles:** Stacked status bars and p95 latency.
6. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the Grafana dashboard showing all 4 panel types with live data.
   - Save the screenshot as: `ScreenShots/11_grafana_dashboard_overview.png`.

---

### Deliverable 12: Traffic Generation & Monitoring Observation
**Goal:** Show dynamic monitoring changes in Prometheus/Grafana immediately after generating burst traffic and controlled 404 errors.

#### Step-by-Step Instructions:
1. Arrange your screen with two visible windows:
   - **Left Window:** PowerShell terminal.
   - **Right Window:** Grafana dashboard at `http://localhost:3005`.
2. In the PowerShell terminal, execute the automated traffic burst script:
   ```powershell
   node test_lab8.js
   ```
3. Watch the script send 30 normal requests and 5 controlled 404 error requests:
   ```
   --- Step 4: Generating API Traffic for Monitoring Observation ---
   Sending 30 sample requests to stimulate Prometheus metrics...
     Traffic generation progress: [30/30 requests sent]
   --- Step 5: Generating Safe Error Traffic (HTTP 404) ---
     -> Safe 404 errors generated to populate error rate monitoring.
   ```
4. Observe the immediate spike in the Grafana **Throughput** graph and the appearance of the red/yellow `Status 404` bar in the **HTTP Status Code Breakdown** panel.
5. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the split-screen view showing the completed `node test_lab8.js` terminal output alongside the Grafana dashboard reflecting the traffic spike.
   - Save the screenshot as: `ScreenShots/12_traffic_burst_grafana_spike.png`.

---

### Deliverable 13: Architecture & Container Registry Delivery
**Goal:** Document the overall system architecture alongside the versioned Docker images published to GitHub Container Registry (GHCR).

#### Step-by-Step Instructions:
1. Open the architecture diagram:
   - Open `Campus-Connect/architecture_diagram.svg` in your browser or image viewer.
2. Open your GitHub Packages / GHCR page in your browser:
   `https://github.com/Vivek-26-12?tab=packages`
3. Verify that all 4 packages are visible with version tags matching the Git commit SHA and `v1`:
   - `api-gateway:v1`
   - `user-service:v1`
   - `product-service:v1`
   - `order-service:v1`
4. Demonstrate the Kubernetes rolling update command in terminal:
   ```powershell
   kubectl set image deployment/api-gateway api-gateway=ghcr.io/vivek-26-12/api-gateway:v1 -n lab8
   kubectl rollout status deployment/api-gateway -n lab8
   ```
5. **How to Take the Screenshot:**
   - Press `Win + Shift + S`.
   - Capture the architecture diagram or the GHCR package list with the terminal rollout status.
   - Save the screenshot as: `ScreenShots/13_architecture_ghcr_registry.png`.

---

## 4. Summary Checklist & Submission Instructions

### 4.1 Verification Checklist
- [x] **D01:** Lab 7 baseline verified with `test_gateway_lab7.js` (16/16 pass).
- [x] **D02:** Kubernetes context, node, and `lab8` namespace verified.
- [x] **D03:** Manifests created with `livenessProbe` and `readinessProbe` (Section 3.3.1).
- [x] **D04:** Workloads deployed in `lab8` with all Pods in `1/1 Running` state.
- [x] **D05:** Postman collection executed against the Gateway (`localhost:3000`).
- [x] **D06:** `user-service` scaled to 3 replicas with traffic distributed.
- [x] **D07:** Pod deletion performed and autonomous self-healing replacement verified.
- [x] **D08:** Troubleshooting commands (`describe`, `logs`, `endpoints`) documented.
- [x] **D09:** GitHub Actions CI/CD workflow tested with GHCR image delivery.
- [x] **D10:** Prometheus scraping target `api-gateway (1/1 UP)` and PromQL queries verified.
- [x] **D11:** Grafana monitoring dashboard imported and verified.
- [x] **D12:** Traffic burst generated using `test_lab8.js` and reflected in metrics.
- [x] **D13:** Architecture diagram and container registry rollout procedure documented.

### 4.2 Packaging Your Final Submission
To package your final submission zip file, run the following command in PowerShell:
```powershell
cd "d:\DA\WSSOA Lab"
tar -a -c -f "202512045_Lab 8.zip" Campus-Connect
```
The resulting archive `202512045_Lab 8.zip` contains all source code, Kubernetes manifests, CI/CD workflows, Postman collection, documentation, and screenshots ready for academic grading.
