# GraphX.AI — 開發者技術文件

> 本文件面向接手專案的開發者，白話說明專案架構、各模組職責、開發流程與注意事項。

---

## 1. 專案概覽

GraphX.AI 是一個 **GNN（圖神經網路）AutoML 平台**，使用者上傳圖結構資料（nodes CSV + edges CSV），平台自動完成：

1. 資料探索 → 2. 特徵分析 → 3. 超參數搜索 + 模型訓練 → 4. 評估 → 5. 模型註冊

**技術棧**：
- 前端：Next.js 16 + React 19 + Ant Design 5 + Recharts + react-force-graph-2d
- 後端：FastAPI + PyTorch + PyTorch Geometric + Optuna
- 資料庫：無（全 in-memory，重啟後資料消失）

---

## 2. 目錄結構

```
LayoutXpert/
├── frontend/                    # Next.js 前端
│   ├── app/                     # App Router 頁面
│   │   ├── layout.tsx           # 根 layout（HTML shell）
│   │   ├── page.tsx             # / → 重導到 /login
│   │   ├── login/page.tsx       # 模擬登入頁
│   │   ├── dashboard/page.tsx   # 專案總覽儀表板
│   │   ├── api-spec/page.tsx    # 內嵌 FastAPI Swagger 文件
│   │   ├── docs/page.tsx        # 使用者文件頁
│   │   └── projects/[id]/       # 專案子頁面（核心流程）
│   │       ├── layout.tsx       # Pipeline Stepper 導覽列
│   │       ├── page.tsx         # 專案總覽（KPI、dataset、training runs）
│   │       ├── upload/page.tsx  # Step 1: 上傳 CSV 或載入 Demo 資料
│   │       ├── explore/page.tsx # Step 2: 資料分析（相關矩陣、圖預覽）
│   │       ├── train/page.tsx   # Step 3: 訓練設定 + 即時進度
│   │       ├── evaluate/page.tsx# Step 4: 評估結果（混淆矩陣、per-node predictions）
│   │       └── models/page.tsx  # Step 5: 模型註冊管理
│   ├── src/
│   │   ├── components/          # 共用元件
│   │   │   ├── AppHeader.tsx    # 頂部導覽列（logo、步驟、dark mode）
│   │   │   ├── AuthGuard.tsx    # 身分驗證守衛（模擬）
│   │   │   ├── ClientProviders.tsx # Context Provider 組合層
│   │   │   ├── GraphPreview.tsx # 力導向圖 2D 視覺化元件
│   │   │   ├── PageTransition.tsx # Framer Motion 頁面動畫
│   │   │   ├── PipelineStepper.tsx # 5 步驟 Pipeline 進度條
│   │   │   ├── PredictionTable.tsx # Per-node/graph 預測結果表格
│   │   │   └── ThemeRegistry.tsx # Ant Design 主題設定
│   │   ├── contexts/            # React Context 狀態管理
│   │   │   ├── AuthContext.tsx   # 登入狀態（模擬，localStorage）
│   │   │   ├── ColorModeContext.tsx # Dark/Light 模式切換
│   │   │   └── ProjectContext.tsx # 當前專案 ID 全域狀態
│   │   ├── lib/
│   │   │   ├── api.ts           # API 客戶端（40+ 個 fetch 函數）
│   │   │   └── mockGraphData.ts # Mock 圖資料產生器（3 種 dataset）
│   │   └── theme/
│   │       └── theme.ts         # Ant Design 主題 token 設定
│   └── package.json
│
├── backend/                     # FastAPI 後端
│   ├── app/
│   │   ├── main.py              # FastAPI 應用入口、CORS、啟動載入 mock data
│   │   ├── core/
│   │   │   ├── config.py        # 設定常數（Optuna trials、模型路徑等）
│   │   │   └── store.py         # In-memory 資料倉庫（dict-based）
│   │   ├── data/
│   │   │   ├── ingestion.py     # CSV 解析（nodes + edges）
│   │   │   ├── pyg_converter.py # DataFrame → PyG Data 轉換器
│   │   │   ├── feature_engineering.py # 欄位分析、缺失值處理、one-hot
│   │   │   └── mock_loader.py   # Demo dataset 載入器
│   │   ├── models/
│   │   │   ├── factory.py       # 模型工廠（根據名稱產生模型實例）
│   │   │   ├── gcn.py           # GCN 模型
│   │   │   ├── gat.py           # GAT 模型
│   │   │   ├── sage.py          # GraphSAGE 模型
│   │   │   ├── gin.py           # GIN 模型
│   │   │   └── mlp.py           # MLP 基線模型
│   │   ├── routers/
│   │   │   ├── projects.py      # 主要 API（專案 CRUD、上傳、訓練、評估）
│   │   │   ├── tasks.py         # 舊版 task API（向下相容）
│   │   │   └── datasets.py      # 舊版 dataset API（向下相容）
│   │   ├── schemas/
│   │   │   └── api_models.py    # Pydantic 請求/回應模型
│   │   └── training/
│   │       ├── pipeline.py      # 訓練主流程（前處理→Optuna HPO→評估）
│   │       ├── optuna_search.py # 超參數搜索邏輯
│   │       └── callbacks.py     # 訓練進度回呼
│   ├── mock_data/               # 5 個 Demo 資料集
│   │   ├── demo_basic/          # 400 nodes, 800 edges, 乾淨資料
│   │   ├── demo_dirty/          # 含 ~5% 缺失值和離群值
│   │   ├── demo_edge_attrs/     # 邊帶屬性（電阻、耦合電容）
│   │   ├── demo_multigraph/     # 3 張獨立圖（graph_A, B, C）
│   │   └── demo_small_multigraph/ # 10 張小圖（graph_01~10）
│   ├── tests/                   # 後端測試
│   └── requirements.txt
│
└── docs/                        # 文件
    ├── technical/               # 技術文件
    ├── usage/                   # 使用者指南
    └── changelog/               # 變更日誌
```

---

## 3. 核心流程：資料 → 訓練 → 評估

```
使用者上傳 CSV ──→ ingestion.py 解析
                      │
                      ▼
               store.py 存入記憶體（nodes_df, edges_df）
                      │
                      ▼
         feature_engineering.py 分析欄位類型、相關性
                      │
                      ▼
         pyg_converter.py 轉成 PyG Data 物件
                      │
                      ▼
         pipeline.py 啟動訓練（背景 Thread）
              │
              ├── optuna_search.py 搜索超參數（模型×hidden_dim×layers×lr×dropout）
              │       │
              │       └── factory.py 產生模型實例 → 訓練 N 個 epoch
              │
              ▼
         最佳模型存到 /storage/models/{task_id}.pt
                      │
                      ▼
         Model Registry 頁面可查看、重新評估
```

---

## 4. 前端架構詳解

### 4.1 路由架構

App Router 使用 `projects/[id]` 動態路由，搭配 `layout.tsx` 提供 Pipeline Stepper 導覽。每個 step 是獨立頁面：

| Step | 路由 | 功能 |
|------|------|------|
| 1 | `/projects/[id]/upload` | 上傳 CSV 或選擇 demo data |
| 2 | `/projects/[id]/explore` | 資料分析：topology、相關矩陣、圖預覽、label 設定 |
| 3 | `/projects/[id]/train` | 設定模型、超參數範圍，啟動訓練 |
| 4 | `/projects/[id]/evaluate` | 查看指標、混淆矩陣、per-node predictions、訓練歷史 |
| 5 | `/projects/[id]/models` | 模型註冊、管理、重新評估 |

### 4.2 狀態管理

- **AuthContext** — 模擬登入，localStorage 存 `isLoggedIn`
- **ProjectContext** — 存當前 project ID，避免 prop drilling
- **ColorModeContext** — Dark/Light 模式切換（cookie + Ant Design ConfigProvider）

所有狀態都是 client-side，沒有 SSR 資料 fetching。

### 4.3 重要元件

**GraphPreview.tsx**
- 使用 `react-force-graph-2d`（Canvas-based）渲染力導向圖
- 支援 node 點擊/hover 顯示屬性面板
- 所有 node/edge ID 強制轉 `String()` 避免型別不匹配
- 會過濾掉 link 中 source/target 不存在的邊，防止 crash

**PredictionTable.tsx**
- 雙模式：node-level 或 graph-level（由 `dataset.taskLevel` 決定）
- 支援搜尋、篩選（graph、class）、排序
- 使用 controlled pagination（`pageSize` state）避免切換頁數失效

**PipelineStepper.tsx**
- 5 步驟進度條，根據 project status 顯示完成狀態
- 每個步驟可點擊跳轉

### 4.4 API 客戶端（`lib/api.ts`）

集中管理所有 API 呼叫，按功能分區：
- Project CRUD（建立、取得、更新、刪除）
- Data Upload（檔案上傳、demo data 載入）
- Exploration（特徵分析、相關矩陣、圖取樣）
- Training（啟動訓練、查詢狀態）
- Evaluation（取得報告、per-node predictions）
- Model Registry（註冊、列表、評估、刪除）

所有函數回傳 Promise，錯誤時 throw Error。

---

## 5. 後端架構詳解

### 5.1 API 路由

主要路由在 `routers/projects.py`，前綴 `/api/v1/projects`：

| 方法 | 端點 | 功能 |
|------|------|------|
| POST | `/` | 建立專案 |
| GET | `/` | 列出所有專案 |
| GET | `/{id}` | 取得專案詳情 |
| PATCH | `/{id}` | 更新專案（名稱、tags） |
| DELETE | `/{id}` | 刪除專案 |
| POST | `/{id}/upload` | 上傳 CSV 資料 |
| POST | `/{id}/load-demo` | 載入 demo 資料集 |
| GET | `/{id}/explore` | 資料分析 |
| GET | `/{id}/graph-sample` | 圖取樣（力導向圖用） |
| POST | `/{id}/confirm` | 確認 label + task type |
| POST | `/{id}/train` | 啟動訓練 |
| GET | `/{id}/experiments/list` | 列出訓練實驗 |
| GET | `/{id}/experiments/{eid}` | 取得實驗報告 |
| GET | `/{id}/models` | 列出已註冊模型 |
| POST | `/{id}/models/{mid}/evaluate` | 重新評估模型 |

### 5.2 In-Memory Store（`core/store.py`）

所有資料存在 Python dict 中：

```python
datasets = {}    # dataset_id → {nodes_df, edges_df, ...}
tasks = {}       # task_id → {status, progress, report, ...}
projects = {}    # project_id → {name, tags, status, ...}
models = {}      # model_id → {path, metrics, config, ...}
```

**注意：伺服器重啟後所有資料消失。** Demo data 會在啟動時自動載入。

### 5.3 訓練流程（`training/pipeline.py`）

1. 從 store 取出 DataFrame
2. `pyg_converter.py` 轉成 PyG Data（含 feature scaling、train/val/test split）
3. Optuna 搜索超參數（預設 10 trials）
4. 每個 trial 訓練一個模型，記錄 validation loss
5. 最佳模型存到 `/storage/models/{task_id}.pt`
6. 產生報告（metrics、confusion matrix、per-node predictions、leaderboard）

訓練在 **背景 Thread** 中執行，前端用 polling 查詢進度。

### 5.4 支援的 GNN 模型

| 模型 | 檔案 | 說明 |
|------|------|------|
| GCN | `gcn.py` | 圖卷積網路 |
| GAT | `gat.py` | 圖注意力網路 |
| GraphSAGE | `sage.py` | 取樣聚合 |
| GIN | `gin.py` | 圖同構網路 |
| MLP | `mlp.py` | 多層感知器（基線） |

所有模型繼承共同介面，透過 `factory.py` 依名稱實例化。

---

## 6. 開發指南

### 6.1 環境設定

```bash
# 後端
cd backend
python -m venv venv
source venv/Scripts/activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev    # http://localhost:3000
```

### 6.2 新增 GNN 模型

1. 在 `backend/app/models/` 新增 `your_model.py`
2. 實作與其他模型相同的介面（`__init__`, `forward`）
3. 在 `factory.py` 的 `MODEL_MAP` 中註冊
4. 前端 `train/page.tsx` 的模型選擇列表會自動從後端取得

### 6.3 新增 Mock 資料集

1. 在 `backend/mock_data/` 建立新目錄
2. 放入 `nodes_train.csv`、`edges_train.csv`（可選 test 版本）
3. 在 `backend/app/data/mock_loader.py` 的 `DEMO_DATASETS` 中註冊
4. 重啟後端，demo data 自動載入

### 6.4 前端新增頁面

1. 在 `frontend/app/projects/[id]/` 下新增資料夾和 `page.tsx`
2. 需要新 API → 在 `lib/api.ts` 新增函數
3. 需要新元件 → 在 `src/components/` 新增
4. 更新 `PipelineStepper.tsx` 的步驟定義（如果是新 step）

---

## 7. 注意事項

### 資料持久化
- **目前全部 in-memory**，不適合正式環境
- 正式化需要：資料庫（PostgreSQL）、檔案儲存（S3）、任務佇列（Celery）

### 身分驗證
- 目前是**模擬登入**（hardcoded 帳密，localStorage 存狀態）
- 正式化需要：JWT token、OAuth、使用者管理

### 效能考量
- 圖預覽：大圖（>1000 nodes）會進行 BFS 取樣，避免 Canvas 效能問題
- 訓練：在背景 Thread 執行，不阻塞 API；但同時只能訓練一個任務
- Pagination：所有表格都是 client-side pagination，資料量大時需改為 server-side

### 已知限制
- 僅支援 CSV 格式輸入（node_id + features + edges with src_id/dst_id）
- 不支援 edge-level prediction tasks
- 不支援 regression + classification 混合任務
- Optuna 預設只跑 10 trials（可在 `config.py` 調整）

### React 19 + Ant Design 5
- Ant Design 5 官方支援到 React 18，在 React 19 下會顯示 compat 警告
- 功能不受影響，但要注意未來升級 antd 版本

---

## 8. 常用開發命令

```bash
# 後端測試
cd backend && python -m pytest tests/ -v

# 前端建置
cd frontend && npm run build

# 前端測試
cd frontend && npx vitest run

# 查看 API 文件
# 啟動後端後瀏覽 http://localhost:8000/docs
```
