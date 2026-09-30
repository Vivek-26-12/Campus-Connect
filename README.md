# Web Services & SOA Laboratory • Lab 7
## API Gateway, Configuration-Based Service Discovery & Cloud Deployment

**Course:** Web Services & SOA Laboratory  
**Lab Assignment:** Lab 7 – Gateway • Service Discovery • Cloud  
**Project:** CampusConnect Microservices Backend  
**Directory:** `d:\DA\WSSOA Lab\Lab 4`  
**Repository Branch/Stack:** Docker Compose + Express.js Microservices + MongoDB Atlas  

---

## 1. Executive Summary & Objective

In **Lab 6**, the monolithic backend was decomposed into three independently runnable microservices: **User Service**, **Product Service**, and **Order Service**. They communicated directly over an internal Docker network, while the concept of an API Gateway remained theoretical.

In **Lab 7**, we turn that concept into a production-grade reality:
1. **Real API Gateway (`api-gateway`):** Built as the single entry point for all client traffic. It manages reverse-proxy routing, centralized request/response latency logging, and centralized error handling (returning clean `502 Bad Gateway` / `504 Gateway Timeout` JSON payloads when target microservices are down or unresponsive).
2. **Configuration-Based Service Discovery:** Eliminates hardcoded service URLs from application code. The Gateway loads downstream locations from a dedicated configuration registry (`config/services.json` and environment variables `USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`), allowing service addresses to be changed on the fly without touching route logic.
3. **Private Network Isolation:** Updated `compose.yaml` / `docker-compose.yml` such that **only port 3000 (API Gateway) is published to the external host**. The User, Product, and Order services are isolated within the internal Docker bridge network (`campus-network`), strictly inaccessible from the outside.
4. **Cloud Deployment & MongoDB Atlas Persistence:** Containerized the microservices stack for cloud execution (Render / Railway / Cloud VM), linking the services to MongoDB Atlas persistent cloud database via environment variables.

---

## 2. System Architecture & Network Topology

### 2.1 Layering Architecture Table

| Layer | Responsibility | Network Accessibility |
|---|---|---|
| **Client / Postman** | Sends all requests to a single public IP/domain | Public Internet |
| **API Gateway** | Routes `/users/*`, `/products/*`, `/orders/*`; health checks; request logging; 502/504 error handling | Public Internet (Port `3000` / Cloud HTTPS) |
| **User / Product / Order Services** | Encapsulate business logic, inter-service validation, and CRUD operations | **Private Docker Network Only** (`campus-network`, Ports `3001`, `3002`, `3003` unmapped on host) |
| **MongoDB Atlas** | Persistent multi-tenant / database-per-service cloud database cluster | Microservices via secure connection string (`MONGODB_URI`) |

### 2.2 Architectural Diagram

```
                             +-----------------------------------------------+
                             |              Client Applications              |
                             |      (Postman / Web Browser / Mobile App)     |
                             +-----------------------------------------------+
                                                     |
                                                     | Public Traffic: HTTP :3000 / HTTPS
                                                     v
                             +-----------------------------------------------+
                             |            API Gateway (:3000)                |
                             |   - Single Public Entry Point                 |
                             |   - Dynamic Service Discovery Registry        |
                             |   - Request / Response Latency Logger         |
                             |   - Centralized 502/504 Failure Interceptor   |
                             +-----------------------------------------------+
                                         /           |           \
           /users/*                     /            |            \          /orders/*
          -----------------------------+             |             +----------------------------
         /                                           | /products/*                              \
        v                                            v                                           v
+---------------------------------------------------------------------------------------------------+
| 🔒 PRIVATE DOCKER BRIDGE NETWORK: campus-network (Host Ports 3001, 3002, 3003 Blocked to Outside)  |
|                                                                                                   |
|  +-------------------------+      +-------------------------+      +-------------------------+    |
|  |   User Service (:3001)  |      | Product Service (:3002) |      |   Order Service (:3003) |    |
|  |  Hostname: user-service |      | Hostname:product-service|      |  Hostname: order-service|    |
|  |  GET /health            |      | GET /health             |      |  GET /health            |    |
|  |  CRUD: /users           |      | CRUD: /products         |      |  Transactions: /orders  |    |
|  +-------------------------+      +-------------------------+      +-------------------------+    |
|               ^                                ^                                |                 |
|               |        GET /users/:id          |         GET /products/:id      |                 |
|               +--------------------------------+--------------------------------+                 |
|                               (Inter-Service Validation Calls)                                    |
+---------------------------------------------------------------------------------------------------+
                                         |           |           |
                                         | MONGODB_URI Connection Strings
                                         v           v           v
                             +-----------------------------------------------+
                             |      ☁️ MongoDB Atlas Cloud Database Cluster    |
                             |      users_db   •   products_db   •   orders_db  |
                             +-----------------------------------------------+
```

> **Vector Architecture Diagram:** See [`architecture_diagram.svg`](./architecture_diagram.svg) for high-resolution interactive viewing.

---

## 3. Discussion Questions & Technical Analysis

### 3.1 Why introduce an API Gateway instead of letting clients call each service directly?
*(Part A Discussion Requirement)*

Direct client-to-microservice communication introduces severe architectural flaws in distributed systems:
1. **Single Public Entry Point:** Without a gateway, clients must know the individual hostnames, IP addresses, and port allocations for every backend microservice (`:3001`, `:3002`, `:3003`). Any split, merge, or relocation of a microservice breaks client code. With an API Gateway, the client interacts solely with one domain/port (e.g. `api.campus.edu` or `:3000`).
2. **Encapsulation & Security (Hiding Internal Structure):** By exposing only the gateway, backend services remain strictly inside a private subnet (`campus-network`). Direct external attacks, unauthorized port scanning, and direct database queries are thwarted because downstream ports are not published to the Internet.
3. **Cross-Cutting Concerns Centralization:** Authentication (JWT verification), SSL/TLS termination, rate limiting, CORS policies, centralized structured logging, and response compression are managed in one location instead of being reimplemented across every service.
4. **Centralized Error Handling & Fault Isolation:** If a downstream service crashes or times out, the gateway intercepts the network socket failure (`ECONNREFUSED`, `ETIMEDOUT`) and translates it into an RFC-compliant JSON response (`502 Bad Gateway` / `504 Gateway Timeout`), preventing raw stack traces or hung connections from leaking to users.
5. **Reduced Protocol Coupling:** The gateway can accept standard HTTP/REST or GraphQL from external clients and translate internally to gRPC, messaging queues (RabbitMQ/Kafka), or internal protocols.

---

### 3.2 Static/Configuration-Based Service Discovery vs. Dynamic Service Discovery
*(Part B Discussion Requirement)*

In this lab, we implemented a **configuration-based service discovery** mechanism where service URLs are defined in `config/services.json` and externalized into environment variables (`USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL`).

#### Contrast Matrix:

| Feature / Dimension | Static / Configuration-Based (This Lab) | Dynamic Service Discovery (Consul / Eureka / K8s DNS) |
|---|---|---|
| **Mechanism** | Reads environment variables or JSON config at startup | Services automatically register/deregister via heartbeats |
| **Instance Scaling** | Requires manual restart/reconfiguration to add replicas | Automatically detects new horizontal container replicas |
| **Health Awareness** | Traffic is routed to configured URL even if instance is failing | Continual health-checking removes unhealthy instances from routing pool |
| **Load Balancing** | Relies on external reverse proxy or static IP | Built-in client-side (Ribbon) or server-side round-robin balancing |
| **Operational Overhead** | Near zero (no separate server daemon or cluster needed) | High (requires maintaining Consul/Eureka clusters, etcd, or K8s control plane) |
| **Suitability** | Predictable, small-to-medium deployments & Docker Compose stacks | Dynamic, autoscaling cloud clusters with volatile ephemeral pods/containers |

**What a Dynamic Registry Adds:**  
A dynamic service registry (such as HashiCorp Consul or Netflix Eureka) introduces **autonomous self-registration** and **ephemeral lifecycle management**. When microservices spin up in response to traffic surges, they register their ephemeral IP addresses dynamically. If an instance experiences an unhandled memory leak or crashes, heartbeat health checks fail, and the registry immediately excises the dead instance from the active routing table without needing any human intervention or gateway restart.

---

## 4. API Gateway Endpoints & Routing Table

The API Gateway runs on port `3000` (or cloud `PORT`) and manages the following routes:

| Gateway Endpoint | HTTP Method | Target Service & Path | Description |
|---|---|---|---|
| `/health` | `GET` | API Gateway Internal | Gateway health status (`UP`), uptime, and active service discovery registry |
| `/services` | `GET` | API Gateway Internal | Dynamic Service Registry table dump |
| `/` | `GET` | API Gateway Internal | Gateway documentation & active routing map |
| `/users` | `GET` | `http://user-service:3001/users` | Retrieve all user profiles |
| `/users/:id` | `GET` | `http://user-service:3001/users/:id` | Retrieve specific user by ID (e.g. `101`) |
| `/users` | `POST` | `http://user-service:3001/users` | Create new user profile |
| `/users/:id` | `PUT` | `http://user-service:3001/users/:id` | Update user details |
| `/users/:id` | `DELETE` | `http://user-service:3001/users/:id` | Remove user profile |
| `/products` | `GET` | `http://product-service:3002/products` | Retrieve catalog products |
| `/products/:id` | `GET` | `http://product-service:3002/products/:id` | Retrieve specific product (e.g. `501`) |
| `/products` | `POST` | `http://product-service:3002/products` | Add new product to catalog |
| `/products/:id` | `PUT` | `http://product-service:3002/products/:id` | Update product price/inventory |
| `/products/:id` | `DELETE` | `http://product-service:3002/products/:id` | Remove product from catalog |
| `/orders` | `GET` | `http://order-service:3003/orders` | Retrieve list of placed orders |
| `/orders/:id` | `GET` | `http://order-service:3003/orders/:id` | Retrieve order details |
| `/orders` | `POST` | `http://order-service:3003/orders` | Place new order (calls User & Product internally) |

---

## 5. Verification & Testing Evidence

### 5.1 Verification Script Execution
Run the automated verification suite:

```powershell
node test_gateway_lab7.js
```

**Live Output:**
```
================================================================
 LAB 7: API GATEWAY, SERVICE DISCOVERY & CLOUD DEPLOYMENT TESTS
 Target Gateway: http://127.0.0.1:3000
================================================================

--- 1. API GATEWAY HEALTH & SERVICE DISCOVERY ---
Testing: GET /health (Gateway Health Check)                   [PASS] (HTTP 200)
Testing: GET /services (Dynamic Service Registry)             [PASS] (HTTP 200)
Testing: GET / (Gateway Dashboard & Routing Table)            [PASS] (HTTP 200)

--- 2. GATEWAY ROUTING: USER SERVICE (/users) ---
Testing: GET /users (List All Users via Gateway)              [PASS] (HTTP 200)
Testing: GET /users/101 (Get User 101 via Gateway)            [PASS] (HTTP 200)
Testing: GET /users/9999 (User Not Found -> 404 via Gateway)  [PASS] (HTTP 404)

--- 3. GATEWAY ROUTING: PRODUCT SERVICE (/products) ---
Testing: GET /products (List All Products via Gateway)        [PASS] (HTTP 200)
Testing: GET /products/501 (Get Product 501 via Gateway)      [PASS] (HTTP 200)
Testing: GET /products/9999 (Product Not Found -> 404 via Gateway) [PASS] (HTTP 404)

--- 4. GATEWAY ROUTING: ORDER SERVICE (/orders) ---
Testing: GET /orders (List All Orders via Gateway)            [PASS] (HTTP 200)
Testing: POST /orders (Place Valid Order via Gateway)         [PASS] (HTTP 201)
Testing: POST /orders (Invalid User 9999 -> 404 via Gateway)  [PASS] (HTTP 404)

--- 5. MICROSERVICE ISOLATION (DOCKER NETWORK ONLY) ---
Testing: Direct User Service Port (:3001) blocked        [PASS] (Connection Refused - Port is private)
Testing: Direct Product Service Port (:3002) blocked     [PASS] (Connection Refused - Port is private)
Testing: Direct Order Service Port (:3003) blocked       [PASS] (Connection Refused - Port is private)

--- 6. CENTRALIZED ERROR HANDLING ---
Testing: GET /non-existent-endpoint (404 Fallback)            [PASS] (HTTP 404)

================================================================
 LAB 7 TEST SUMMARY: Passed: 16 | Failed: 0
================================================================
>>> ALL LAB 7 GATEWAY & ISOLATION CHECKS PASSED SUCCESSFULLY! <<<
```

---

### 5.2 Fault Tolerance & Centralized 502/504 Handling Test

1. **Stop Downstream Microservice:**
   ```powershell
   docker stop user-service
   ```
2. **Trigger Request through Gateway:**
   ```powershell
   curl -i http://localhost:3000/users
   ```
3. **Observed Gateway Interception Response (`502 Bad Gateway`):**
   ```json
   {
     "success": false,
     "status": 502,
     "error": "Bad Gateway",
     "message": "Gateway failed to reach downstream microservice 'User Service' at http://user-service:3001.",
     "targetService": "User Service",
     "targetUrl": "http://user-service:3001/users",
     "timestamp": "2026-09-28T18:52:02.287Z",
     "details": "fetch failed"
   }
   ```
4. **Gateway Console Log Proof:**
   ```
   [API-Gateway ERROR] 2026-09-28T18:52:02.287Z | GET /users -> User Service [Status: 502] (24ms) | Cause: fetch failed
   ```
5. **Restart Service & Verify Auto-Recovery:**
   ```powershell
   docker start user-service
   ```
   Calling `GET http://localhost:3000/users` immediately returns `200 OK` with all user records restored.

---

### 5.3 Service Discovery Proof (Config Change Without Code Change)
To prove that service discovery is strictly configuration-driven:
1. In `.env`, modify the User Service port/location:
   ```env
   USER_SERVICE_URL=http://user-service:3001
   ```
2. Alternatively, create an override in `api-gateway/config/services.json`.
3. Restart only the Gateway container:
   ```powershell
   docker compose restart api-gateway
   ```
4. Inspect `GET http://localhost:3000/services` or `/health`: the gateway immediately rebuilds its routing table with the new target URL without changing a single line of JavaScript code.

---

## 6. Cloud Deployment Guide (Part C)

### 6.1 Live Production Deployment on Railway (`pleasing-communication`)
All 4 containerized microservices are live and deployed in production on **Railway**:

| Service | Live Cloud Public URL | Status |
|---|---|---|
| **API Gateway** | `https://campusconnect-api-gateway-production.up.railway.app` | **Online (Port 3000 / Ingress)** |
| **User Service** | `https://campusconnect-user-service-production.up.railway.app` | **Online (Port 3001)** |
| **Product Service** | `https://campusconnect-product-service-production.up.railway.app` | **Online (Port 3002)** |
| **Order Service** | `https://campusconnect-order-service-production.up.railway.app` | **Online (Port 3003)** |

### 6.2 Service Discovery & Environment Configuration on Railway
The Gateway discovers backend services dynamically via environment variables configured in Railway's **Variables** tab:
* `USER_SERVICE_URL` = `https://campusconnect-user-service-production.up.railway.app`
* `PRODUCT_SERVICE_URL` = `https://campusconnect-product-service-production.up.railway.app`
* `ORDER_SERVICE_URL` = `https://campusconnect-order-service-production.up.railway.app`

### 6.3 Testing Against Cloud Gateway URL in Postman
1. Open Postman and import [`CampusConnect_Lab7_API_Gateway.postman_collection.json`](./CampusConnect_Lab7_API_Gateway.postman_collection.json).
2. Click the collection, open the **Variables** tab.
3. Update the `baseUrl` variable:
   - **Current Value:** `https://campusconnect-api-gateway-production.up.railway.app`
4. Execute the requests:
   - `GET {{baseUrl}}/health` → Status `200 OK`
   - `GET {{baseUrl}}/users` → Status `200 OK`
   - `POST {{baseUrl}}/orders` → Status `201 Created`
   - Full flow confirmed over public internet: **Postman → Cloud API Gateway → Microservices → MongoDB Atlas!**

---

## 7. Troubleshooting Notes

1. **Port `3000` Already In Use:**
   If another service occupies port 3000, run `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force` or adjust `GATEWAY_PORT=3005` in `.env`.
2. **Microservice Ports (:3001, :3002, :3003) Refusing Connection:**
   This is **expected behavior** in Lab 7. Microservice ports are intentionally unmapped from the host (`compose.yaml` uses `expose` instead of `ports`). Access all endpoints through `http://localhost:3000/...`.
3. **Docker DNS Resolution Issue (`ENOTFOUND user-service`):**
   Ensure all containers reside on the same custom bridge network (`campus-network`). Default Docker bridge network does not support automatic container DNS resolution.
4. **MongoDB Atlas Connection Timeout:**
   In the Atlas security console, ensure Network Access allows the cloud deployment IP range (or `0.0.0.0/0` during development testing).

---

## 8. Written Reflection (5–8 Lines)

The transition from Lab 6's direct microservice interaction to Lab 7's API Gateway and cloud deployment fundamentally transformed system operation. Decoupling clients from internal topology allowed us to lock down microservice ports completely behind a private Docker network, reducing external attack vectors and simplifying client integration down to a single base URL. Centralizing request logging and error interceptors at the gateway replaced fragmented, service-specific error debugging with unified, RFC-compliant 502/504 diagnostics and latency tracking. Furthermore, externalizing service registries into declarative environment configurations eliminated brittle code-level dependencies, enabling zero-code endpoint redirection across both local container networks and live cloud platforms.

---

## 9. Submission Checklist (Lab 7)

- [x] **API Gateway Created:** `api-gateway` Express service with reverse proxying to User, Product, and Order services.
- [x] **Gateway Health Check:** `GET /health` implemented and verified.
- [x] **Service Discovery:** Externalized configuration in `services.json` and `.env` (`USER_SERVICE_URL`, etc.).
- [x] **Docker Compose Security:** Only port `3000` is exposed on the host; microservice ports `3001`, `3002`, `3003` are private.
- [x] **Centralized Error Handling:** Gateway intercepts downstream failures and returns clean `502 Bad Gateway` / `504 Gateway Timeout`.
- [x] **Request Logging:** Request method, path, target service, response status, and duration logged at the gateway.
- [x] **Postman Collection:** `CampusConnect_Lab7_API_Gateway.postman_collection.json` with `{{baseUrl}}` variable.
- [x] **Automated Tests:** Both `test_gateway_lab7.js` (16/16) and `test_microservices.js` (15/15) passing.
- [x] **Architecture Diagram:** Updated SVG showing Client → Gateway → Private Services → MongoDB Atlas.
- [x] **Discussion Questions & Reflection:** Fully answered in README.md.
