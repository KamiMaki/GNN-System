  
**GNN Circuit Analysis System**

Backend API Architecture & Development Plan

System Architecture Analysis Report  
Version 1.0  |  February 2026

# **Table of Contents**

**1\.  Executive Summary**

**2\.  System Overview & Architecture**

**3\.  Core Module Breakdown**

  3.1  Module A – API Gateway & Task Management

  3.2  Module B – Data Ingestion & Preprocessing

  3.3  Module C – Task Dispatcher & AutoML Engine

  3.4  Module D – GNN Training Engine

  3.5  Module E – Evaluation & Report Generation

  3.6  Module F – Storage & Model Registry

**4\.  Data Flow & System Sequence**

**5\.  Technology Stack Recommendations**

**6\.  Development Timeline & Milestones**

**7\.  Verification & Validation Strategy**

**8\.  Risk Analysis & Mitigation**

**9\.  Summary & Next Steps**

# **1\. Executive Summary**

This report presents a comprehensive backend system architecture for an automated Graph Neural Network (GNN) training platform tailored to electronic circuit analysis. The system accepts circuit graph data from users via RESTful APIs, automatically determines the appropriate GNN model architecture and training configuration based on the task type (e.g., circuit classification, node-level prediction, timing estimation), executes training, and returns a structured evaluation report.

The design follows a modular, microservice-friendly architecture with six core modules that can be developed independently, tested in isolation, and integrated incrementally. The report includes a detailed development timeline spanning approximately 14–18 weeks, along with a multi-phase verification and validation (V\&V) strategy to ensure correctness, robustness, and production readiness.

| 🎯 Core Design Principles Modularity (independent, testable components) • Task-Aware Automation (auto-select GNN architecture per task) • Reproducibility (versioned data, models, configs) • Scalability (async training, queue-based dispatch) • Extensibility (easy to add new GNN variants or task types) |
| :---- |

# **2\. System Overview & Architecture**

The system operates as a stateless API backend with asynchronous training capabilities. A user submits circuit graph data along with task metadata; the system processes, trains, and returns results—all through HTTP endpoints. The architecture is divided into six major modules:

| Module | Name | Responsibility |
| :---- | :---- | :---- |
| **A** | API Gateway & Task Mgmt | REST endpoints, auth, task lifecycle, status polling |
| **B** | Data Ingestion & Preprocessing | Parse graph formats, validate, normalize, feature engineering |
| **C** | Task Dispatcher & AutoML | Determine GNN type, hyperparameters, model architecture |
| **D** | GNN Training Engine | Execute training loop, checkpointing, early stopping |
| **E** | Evaluation & Reporting | Compute metrics, generate structured JSON/PDF report |
| **F** | Storage & Model Registry | Persist datasets, models, configs, training history |

## **High-Level Data Flow**

The request lifecycle follows a linear pipeline with feedback loops for status updates:

| Step | Action | Detail |
| :---- | :---- | :---- |
| **1** | User uploads graph data \+ task config | POST /api/v1/tasks |
| **2** | API Gateway validates & creates task | Module A → Task ID returned |
| **3** | Data Ingestion parses & preprocesses | Module B → PyG Data objects |
| **4** | Dispatcher selects model & hyperparams | Module C → Training config |
| **5** | Training Engine executes GNN training | Module D → Trained model |
| **6** | Evaluator computes metrics & report | Module E → Report JSON |
| **7** | Results persisted & returned to user | Module F \+ GET /api/v1/tasks/{id}/report |

# **3\. Core Module Breakdown**

## **3.1 Module A – API Gateway & Task Management**

This module serves as the single entry point for all external communication. It exposes RESTful endpoints for task submission, status querying, and report retrieval. It handles authentication, rate limiting, request validation, and task lifecycle management.

**API Endpoints**

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| **POST** | /api/v1/tasks | Submit new training task with graph data & config |
| **GET** | /api/v1/tasks/{task\_id} | Query task status (queued / running / completed / failed) |
| **GET** | /api/v1/tasks/{task\_id}/report | Retrieve training report (JSON or PDF) |
| **GET** | /api/v1/tasks/{task\_id}/model | Download trained model weights |
| **DELETE** | /api/v1/tasks/{task\_id} | Cancel a running or queued task |
| **GET** | /api/v1/tasks | List all tasks for authenticated user (paginated) |
| **POST** | /api/v1/tasks/{task\_id}/predict | Use trained model for inference on new data |

**Key Responsibilities**

**Request Validation:** Validate incoming payloads (file format, required fields, size limits). Return structured error responses with clear messages.

**Task Lifecycle:** Create task records in database with status tracking (QUEUED → PREPROCESSING → TRAINING → EVALUATING → COMPLETED / FAILED). Support webhook callbacks for async notification.

**Authentication & Rate Limiting:** JWT-based auth with API key support. Per-user concurrency limits to prevent resource abuse.

**Task Queue Integration:** Push validated tasks onto a message queue (Celery \+ Redis or RabbitMQ) for async processing by downstream modules.

## **3.2 Module B – Data Ingestion & Preprocessing**

This module transforms raw circuit data into PyTorch Geometric (PyG) Data objects suitable for GNN training. It must handle multiple input formats and perform domain-specific feature engineering for electronic circuits.

**Supported Input Formats**

| Format | Description | Parsing Strategy |
| :---- | :---- | :---- |
| Netlist (SPICE) | Standard circuit description | Parse components → nodes, connections → edges |
| JSON Graph | Custom adjacency \+ feature format | Direct mapping to PyG Data |
| GraphML / GML | Standard graph exchange formats | NetworkX → PyG conversion |
| CSV (edge list) | Edge pairs \+ optional attributes | Build sparse adjacency matrix |
| Verilog / VHDL | RTL / gate-level netlists | HDL parser → DAG → graph (Phase 2\) |

**Preprocessing Pipeline**

**1\. Format Detection & Parsing:** Auto-detect input format from file extension and content. Parse into intermediate NetworkX graph representation.

**2\. Schema Validation:** Verify graph connectivity, node/edge attribute completeness, and label availability. Reject malformed data with descriptive errors.

**3\. Feature Engineering:** Encode component types (resistor, capacitor, transistor) as one-hot or embedding vectors. Compute structural features: degree, centrality, clustering coefficient. Edge features: component values, connection types, signal direction.

**4\. Normalization & Splitting:** Normalize continuous features (z-score or min-max). Split dataset into train/validation/test (configurable ratios, default 70/15/15). Support stratified splitting for classification tasks.

## **3.3 Module C – Task Dispatcher & AutoML Engine**

The dispatcher is the “brain” of the system. Based on the user-specified task type and the structural properties of the uploaded graph, it automatically selects the GNN architecture, loss function, evaluation metrics, and hyperparameter search space.

**Supported Task Types**

| Task Type | GNN Architecture | Loss Function | Key Metrics |
| :---- | :---- | :---- | :---- |
| Graph Classification | GIN, GAT \+ Pooling | CrossEntropy / Focal | Accuracy, F1, AUC |
| Node Classification | GCN, GraphSAGE, GAT | CrossEntropy | Accuracy, Macro-F1 |
| Graph Regression | MPNN, SchNet-style | MSE / Huber | MAE, RMSE, R² |
| Node Regression | GCN, GAT | MSE / Huber | MAE, RMSE |
| Link Prediction | GCN \+ Decoder | BCE | AUC, AP, Hits@K |
| Anomaly Detection | GAE, GCN-AE | Reconstruction | AUC, Precision, Recall |

**AutoML Logic**

**Architecture Selection:** Rule-based heuristics first (graph size, density, feature dimensionality), with optional Bayesian optimization (Optuna) for hyperparameter tuning if the user enables extended search.

**Hyperparameter Space:** Hidden dimensions (32–256), number of GNN layers (2–6), learning rate (1e-4 to 1e-2), dropout (0.0–0.5), batch size, pooling strategy (mean, sum, attention). Pre-defined sensible defaults per task type.

**Config Generation:** Produces a fully specified training configuration JSON that is versioned and stored alongside results for reproducibility.

## **3.4 Module D – GNN Training Engine**

The core training module executes the GNN training loop based on the configuration provided by Module C. Built on PyTorch Geometric, it supports GPU acceleration, mixed-precision training, and robust checkpoint management.

**Training Pipeline Components**

**Model Factory:** Dynamically instantiate GNN models (GCN, GAT, GIN, GraphSAGE, MPNN) with task-specific heads (classification, regression, link prediction decoders).

**Training Loop:** Standard epoch-based training with configurable optimizer (Adam, AdamW), scheduler (CosineAnnealing, ReduceOnPlateau), gradient clipping, and mixed-precision (AMP) support.

**Early Stopping:** Monitor validation metric with configurable patience (default: 15 epochs). Restore best model weights on termination.

**Checkpointing:** Save model state, optimizer state, and training metrics at each improvement. Support resume-from-checkpoint for interrupted tasks.

**Progress Tracking:** Real-time training metrics (loss, validation score per epoch) stored in database and accessible via status API.

## **3.5 Module E – Evaluation & Report Generation**

After training completes, this module evaluates the model on the held-out test set and generates a comprehensive, structured report. The report is designed to give users actionable insights into model performance.

**Report Contents**

| Section | Details |
| :---- | :---- |
| **Task Summary** | Task type, dataset stats (nodes, edges, features, classes), split ratios |
| **Model Architecture** | GNN type, layer config, parameters count, pooling method |
| **Training Config** | Hyperparameters, optimizer, scheduler, epochs, batch size |
| **Training Curves** | Loss curve, validation metric curve (as data points for plotting) |
| **Test Metrics** | All relevant metrics with confidence intervals (bootstrap) |
| **Confusion Matrix** | For classification tasks: per-class precision, recall, F1 |
| **Feature Importance** | GNN attention weights or gradient-based attribution analysis |
| **Reproducibility Info** | Random seeds, library versions, config hash, data hash |

**Output Formats**

**JSON:** Structured report for programmatic consumption (default). Includes all metrics, curves as arrays, and metadata.

**PDF (optional):** Human-readable formatted report with embedded charts, generated via matplotlib \+ reportlab.

## **3.6 Module F – Storage & Model Registry**

This module manages persistent storage for all system artifacts: uploaded datasets, processed graph data, trained models, configuration files, and generated reports.

**Storage Architecture**

| Artifact | Storage | Retention Policy |
| :---- | :---- | :---- |
| Task metadata | PostgreSQL | Permanent (soft delete) |
| Raw uploaded files | Object Store (S3/MinIO) | 30 days after task completion |
| Processed PyG data | Object Store | Linked to model lifecycle |
| Model weights | Object Store \+ Registry | User-managed (default: 90 days) |
| Training configs | PostgreSQL (JSONB) | Permanent |
| Reports | Object Store | Permanent |
| Training logs | Object Store | 60 days (compressed) |

# **4\. Data Flow & System Sequence**

The complete system operates as a pipeline with asynchronous handoffs between modules. Below is the detailed sequence for a typical training request:

**Request Phase (Synchronous, \< 1 second)**

1\. User sends POST /api/v1/tasks with multipart form data (graph file \+ task config JSON).

2\. Module A validates the request, stores raw file in object storage, creates a task record (status: QUEUED), and pushes a message to the task queue.

3\. API returns immediately with task\_id and status URL. User can poll or provide a webhook.

**Processing Phase (Asynchronous, minutes to hours)**

4\. A Celery worker picks up the task. Module B reads the raw file, detects format, parses into graph, validates, engineers features, splits dataset. Status: PREPROCESSING.

5\. Module C analyzes the processed data and task type, selects GNN architecture and hyperparameters, generates training config. Status: CONFIGURING.

6\. Module D instantiates the model, runs the training loop with early stopping. Epoch metrics are written to the database in real-time. Status: TRAINING.

7\. Module E evaluates on the test set, computes all metrics, generates the report. Status: EVALUATING.

8\. Module F persists the model weights and report. Status: COMPLETED.

**Retrieval Phase (Synchronous)**

9\. User calls GET /api/v1/tasks/{task\_id}/report to retrieve the JSON/PDF report.

10\. User can optionally download the model via GET /api/v1/tasks/{task\_id}/model or run inference via POST /api/v1/tasks/{task\_id}/predict.

# **5\. Technology Stack Recommendations**

| Layer | Technology | Rationale |
| :---- | :---- | :---- |
| **API Framework** | FastAPI (Python) | Async-native, auto OpenAPI docs, type-safe |
| **Task Queue** | Celery \+ Redis | Mature, battle-tested async task processing |
| **GNN Framework** | PyTorch Geometric (PyG) | Most complete GNN library, active community |
| **AutoML / HPO** | Optuna | Flexible, supports pruning, DB-backed |
| **Database** | PostgreSQL | JSONB for flexible configs, robust, well-supported |
| **Object Storage** | MinIO (dev) / S3 (prod) | S3-compatible, self-hostable for development |
| **Containerization** | Docker \+ Docker Compose | Reproducible environments, easy deployment |
| **Monitoring** | Prometheus \+ Grafana | Training metrics, queue depth, system health |
| **CI/CD** | GitHub Actions | Automated testing, linting, container builds |
| **Graph Parsing** | NetworkX \+ PySpice | NetworkX for general graphs, PySpice for SPICE netlists |

# **6\. Development Timeline & Milestones**

The following timeline assumes a team of 2–3 backend/ML engineers. Total estimated duration is 14–18 weeks, divided into four phases. Each phase concludes with a verification milestone before proceeding.

## **Phase 1: Foundation (Weeks 1–4)**

| Week | Deliverable | Module |
| :---- | :---- | :---- |
| **Week 1** | Project scaffolding, Docker setup, DB schema, CI pipeline | Infrastructure |
| **Week 2** | API endpoints (CRUD tasks), auth middleware, request validation | Module A |
| **Week 3** | Graph parsers (JSON, edge list, GraphML), validation, feature eng. | Module B |
| **Week 4** | Storage layer (MinIO integration, model registry basics) | Module F |

| ✅ Milestone 1 Gate End-to-end upload: user can upload a graph file, system parses it, stores it, and returns a valid task\_id with status. Unit tests pass for all parsers. |
| :---- |

## **Phase 2: Core Training (Weeks 5–9)**

| Week | Deliverable | Module |
| :---- | :---- | :---- |
| **Week 5–6** | Task dispatcher: rule-based model selection for 3 core task types (graph clf, node clf, graph reg) | Module C |
| **Week 7–8** | GNN training loop: GCN \+ GAT, early stopping, checkpointing, GPU support | Module D |
| **Week 9** | Celery integration: async task pipeline connecting A → B → C → D | Integration |

| ✅ Milestone 2 Gate Full training pipeline: user uploads data, system auto-selects model, trains GCN/GAT, returns trained model. Verified on 2+ benchmark datasets (e.g., MUTAG, Cora). |
| :---- |

## **Phase 3: Evaluation & Polish (Weeks 10–13)**

| Week | Deliverable | Module |
| :---- | :---- | :---- |
| **Week 10–11** | Evaluation module: metrics computation, report generation (JSON \+ optional PDF) | Module E |
| **Week 12** | AutoML (Optuna HPO), additional GNN variants (GIN, GraphSAGE) | Module C \+ D |
| **Week 13** | Inference endpoint, progress tracking, webhook notifications | Module A \+ D |

| ✅ Milestone 3 Gate Complete pipeline with reports: user gets a full training report with metrics, training curves, and model download. HPO produces measurably better models than defaults on benchmarks. |
| :---- |

## **Phase 4: Hardening & Deployment (Weeks 14–18)**

| Week | Deliverable | Module |
| :---- | :---- | :---- |
| **Week 14–15** | Integration testing, stress testing, error handling audit | All modules |
| **Week 16** | Security audit (input sanitization, auth hardening, rate limits) | Module A |
| **Week 17** | Monitoring (Prometheus/Grafana), logging, alerting setup | Infrastructure |
| **Week 18** | Deployment automation, documentation, API docs review | All |

| ✅ Milestone 4 Gate (Release) Production readiness: passes load test (N concurrent users), security scan clean, monitoring dashboards live, API documentation complete, deployment scripts verified. |
| :---- |

# **7\. Verification & Validation Strategy**

The V\&V strategy is structured across four levels, each providing progressively broader confidence in system correctness. Verification asks “are we building it right?” while validation asks “are we building the right thing?”

## **Level 1: Unit Testing**

**Scope:** Individual functions and classes within each module.

**Coverage Target:** ≥ 80% line coverage for all modules, ≥ 90% for Module B (data parsing) and Module C (task dispatch).

**Key Test Cases**

| Module | Unit Test Focus Areas |
| :---- | :---- |
| **A** | Request validation (valid/invalid payloads), auth token parsing, task state transitions |
| **B** | Each parser (SPICE, JSON, GraphML, CSV) with valid/malformed inputs, feature engineering correctness, split reproducibility |
| **C** | Model selection logic per task type, hyperparameter range validation, config schema completeness |
| **D** | Model instantiation, single training step (forward \+ backward), checkpoint save/load, early stopping trigger |
| **E** | Metric computation against known values, report schema validation, edge cases (single-class, all-same predictions) |
| **F** | CRUD operations, object store upload/download, cleanup/retention logic |

## **Level 2: Integration Testing**

**Scope:** Cross-module data flow and API contract adherence.

**Integration Test Scenarios**

1\. Upload-to-Storage: File upload via API → parsed by Module B → stored in Module F → retrievable.

2\. Config-to-Training: Module C config → Module D model instantiation → runs 1 epoch without error.

3\. Full Pipeline (small data): End-to-end on a tiny dataset (\< 100 nodes) → verify report schema correct.

4\. Error Propagation: Malformed input at each stage → correct error code at API level, task marked FAILED with reason.

5\. Concurrent Tasks: Submit multiple tasks simultaneously → verify isolation (no data leakage between tasks).

## **Level 3: Benchmark Validation**

**Scope:** Verify that the system produces GNN models with competitive performance on known benchmarks.

**Benchmark Suite**

| Dataset | Task | Baseline (Literature) | Acceptance Threshold |
| :---- | :---- | :---- | :---- |
| MUTAG | Graph Classification | GIN: \~89% Acc | ≥ 85% Accuracy |
| Cora | Node Classification | GCN: \~81% Acc | ≥ 78% Accuracy |
| QM9 | Graph Regression | MPNN: low MAE | Within 10% of SOTA MAE |
| Custom Circuit\* | Classification | N/A (establish) | Baseline established |

*\*Custom Circuit dataset: A curated set of real circuit graphs (provided by domain experts) used to validate domain-specific feature engineering.*

## **Level 4: System & Performance Testing**

**Load Testing:** Simulate concurrent user submissions (target: 10–50 concurrent tasks) using Locust or k6. Measure queue latency, API response times (P50, P95, P99), and resource utilization.

**Fault Tolerance:** Kill a training worker mid-task → verify task is re-queued and resumes from checkpoint. Database failover test. Object store unavailability handling.

**Reproducibility Test:** Run the same task (same data \+ same config \+ same seed) three times → verify identical metrics within floating-point tolerance.

**Security Testing:** Input fuzzing (malicious graph files, oversized payloads, injection in metadata fields), auth bypass attempts, rate limit enforcement.

# **8\. Risk Analysis & Mitigation**

| Risk | Likelihood | Impact | Mitigation |
| :---- | :---- | :---- | :---- |
| Diverse circuit formats | High | High | Start with 2–3 formats, design extensible parser interface. Phase in Verilog/VHDL later. |
| Long training times | Medium | Medium | GPU queueing, timeout limits, early stopping. Warn users with estimated time. |
| AutoML over-fitting config | Medium | High | Conservative default hyperparameters. HPO validated on separate hold-out. Limit search budget. |
| OOM on large graphs | Medium | High | Pre-check graph size, mini-batch training (NeighborLoader), graph sampling strategies. |
| Malicious file uploads | Low | High | Sandboxed parsing, file size limits, content-type validation, no code execution from user files. |
| Scope creep (new tasks) | High | Medium | Modular design with clear interfaces. New task types plug into existing pipeline via config. |

# **9\. Summary & Next Steps**

## **Six Core Modules at a Glance**

| \# | Module | One-Line Summary |
| :---- | :---- | :---- |
| **A** | **API Gateway & Task Mgmt** | REST API entry point: receives data, manages task lifecycle, returns results |
| **B** | **Data Ingestion & Preprocessing** | Parses circuit files into PyG graph objects with domain-specific features |
| **C** | **Task Dispatcher & AutoML** | Auto-selects GNN architecture, hyperparameters, and training config per task type |
| **D** | **GNN Training Engine** | Executes training loop with early stopping, checkpointing, and GPU acceleration |
| **E** | **Evaluation & Reporting** | Computes metrics, generates structured JSON/PDF reports with full reproducibility info |
| **F** | **Storage & Model Registry** | Manages persistence of datasets, models, configs, and reports with lifecycle policies |

## **Development Summary**

| Item | Detail |
| :---- | :---- |
| **Total Duration** | 14–18 weeks (2–3 engineers) |
| **Phase 1 – Foundation** | Weeks 1–4: API, parsers, storage |
| **Phase 2 – Core Training** | Weeks 5–9: Dispatcher, training engine, async pipeline |
| **Phase 3 – Eval & Polish** | Weeks 10–13: Reports, AutoML, inference endpoint |
| **Phase 4 – Hardening** | Weeks 14–18: Testing, security, monitoring, deployment |
| **V\&V Approach** | 4 levels: Unit → Integration → Benchmark → System/Perf |

## **Recommended Next Steps**

1\. Finalize the supported circuit file formats for Phase 1 (recommend starting with JSON Graph \+ SPICE netlist).

2\. Define the exact task types to support in the MVP (recommend: graph classification \+ node classification \+ graph regression).

3\. Identify or curate 2–3 benchmark circuit datasets for validation.

4\. Set up the development environment: Docker Compose stack with PostgreSQL, Redis, MinIO.

5\. Begin Phase 1 development with Module A (API) and Module B (parsers) in parallel.

*— End of Report —*