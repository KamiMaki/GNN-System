# LayoutXpert 系統功能清單

> **Purpose**: 供 PM 與 DevOps 了解目前系統支援的功能，作為後續改進與需求規劃的基礎。
> **Date**: 2026-03-11
> **Version**: MVP (in-memory store, no persistent database)

---

## 目錄

1. [系統概述](#系統概述)
2. [使用者認證](#使用者認證)
3. [專案管理](#專案管理)
4. [資料管理](#資料管理)
5. [資料分析與探索](#資料分析與探索)
6. [模型訓練](#模型訓練)
7. [評估與報告](#評估與報告)
8. [API Endpoints 總覽](#api-endpoints-總覽)
9. [技術架構](#技術架構)
10. [已知限制](#已知限制)
11. [待改進項目](#待改進項目)

---

## 系統概述

LayoutXpert 是一個用於 **IC 佈局圖資料** 的自動化 GNN（Graph Neural Network）訓練與分析平台。使用者可以上傳電路佈局的 graph 資料，透過引導式 4 步驟流程完成資料分析、模型訓練及評估。

**核心工作流程**：
```
建立專案 → 上傳資料 → 資料分析 → 模型訓練 → 評估結果
```

**目標使用者**：IC 設計工程師、佈局工程師、晶片架構師

---

## 使用者認證

| 功能 | 狀態 | 說明 |
|------|------|------|
| 登入頁面 | ✅ 已實作 | 企業 SSO 風格登入介面 |
| SSO Provider 選擇 | ✅ UI 已實作 | 支援 Corporate LDAP / SAML 2.0 / Azure AD（僅 UI，非真實整合）|
| 帳號密碼輸入 | ✅ UI 已實作 | 任意輸入皆可登入（Mock 模式）|
| 記住我 | ✅ UI 已實作 | Checkbox 存在但未實際影響行為 |
| 忘記密碼 | ✅ UI 已實作 | 連結存在但無功能 |
| Session 持久化 | ✅ 已實作 | 使用 localStorage 儲存 mock user |
| 登出 | ✅ 已實作 | 清除 localStorage，導向登入頁 |
| 路由保護 | ❌ 未實作 | 未登入仍可存取所有頁面 |
| 真實 SSO 整合 | ❌ 未實作 | 目前為 Mock 模式 |

**Mock 使用者資訊**：
- 姓名：Alex Chen
- Email：alex.chen@chip-design.com

---

## 專案管理

| 功能 | 狀態 | 說明 |
|------|------|------|
| 建立專案 | ✅ 已實作 | 輸入專案名稱 + 標籤（Tags）|
| 專案列表 | ✅ 已實作 | 卡片式顯示，含搜尋 + 標籤篩選 |
| 刪除專案 | ✅ 已實作 | 確認對話框後刪除 |
| 專案狀態追蹤 | ✅ 已實作 | 6 種狀態：created / data_uploaded / data_confirmed / training / completed / failed |
| 步驟進度顯示 | ✅ 已實作 | 4 步驟進度條（Upload / Analysis / Training / Evaluation）|
| 標籤篩選 | ✅ 已實作 | 最多顯示 8 個標籤供快速篩選 |
| 專案搜尋 | ✅ 已實作 | 依名稱和標籤搜尋 |
| 修改專案名稱 | ✅ 已實作 | Dashboard 卡片上可點擊編輯按鈕重新命名 |
| 最後更新時間 | ✅ 已實作 | 顯示相對時間（e.g., "2h ago"）|
| 專案總覽頁面 | ✅ 已實作 | `/projects/[id]` 總覽頁，顯示資料集資訊、訓練歷程、快速導航 |
| 實驗管理（Training Runs）| ✅ 已實作 | 專案總覽頁列出所有訓練紀錄，含狀態/指標/最佳模型/持續時間，支援即時輪詢 |

---

## 資料管理

### 資料上傳

| 功能 | 狀態 | 說明 |
|------|------|------|
| 資料夾上傳 | ✅ 已實作 | 透過 `webkitdirectory` 選擇包含 CSV 的資料夾 |
| 資料結構偵測 | ✅ 已實作 | 自動偵測子資料夾中的 graph 結構 |
| 檔案驗證 | ✅ 已實作 | 檢查 `nodes_train.csv` + `edges_train.csv` 是否存在 |
| 可選測試資料 | ✅ 已實作 | 支援 `nodes_test.csv` + `edges_test.csv` |
| 自動分割 | ✅ 已實作 | 若無測試檔，自動 80/20 分割 |
| 多圖支援 | ✅ 已實作 | 一個資料夾可包含多個 graph 子資料夾 |
| 資料集命名 | ✅ 已實作 | 可選，預設從資料夾名稱偵測 |
| 範例資料下載 | ✅ 已實作 | 提供 .zip 範例檔案下載連結 |

### Demo 資料集

| 資料集 | 說明 | 節點數 | 邊數 | 特點 |
|--------|------|--------|------|------|
| Basic | 基本單圖 | ~30K | ~90K | 乾淨資料，單圖 |
| Edge Attributes | 含邊特徵 | ~30K | ~90K | 邊有額外特徵欄位 |
| Multi-graph | 多圖 | 多個 | 多個 | 多個 graph 在同一資料集 |
| Dirty | 含髒資料 | ~30K | ~90K | 含缺失值和離群值 |

---

## 資料分析與探索

| 功能 | 狀態 | 說明 |
|------|------|------|
| 圖拓撲統計 | ✅ 已實作 | 顯示節點數、邊數 |
| 特徵相關矩陣 | ✅ 已實作 | 互動式選擇欄位，即時計算相關係數 |
| 單欄位分析 | ✅ 已實作 | 選擇任意欄位查看詳細統計 |
| 數值型統計 | ✅ 已實作 | Mean / Median / Std / Min / Max / Q1 / Q3 / 離群值數量 |
| 數值型直方圖 | ✅ 已實作 | 自動分箱的長條圖 |
| 類別型統計 | ✅ 已實作 | Top value、value counts 長條圖 |
| 高基數偵測 | ✅ 已實作 | >50 unique values 時跳過圖表渲染，顯示警告 |
| ID 欄位偵測 | ✅ 已實作 | unique count = 節點數時識別為 ID 欄位 |
| 型態覆寫 | ✅ 已實作 | 可手動切換欄位為 Numeric ↔ Categorical |
| 缺失值偵測 | ✅ 已實作 | 顯示各欄位缺失數量和百分比 |
| 缺失值填補 | ✅ 已實作 | 支援 Mean / Median / Zero 三種方法 |
| 標籤欄位驗證 | ✅ 已實作 | 驗證標籤欄位是否適合指定任務類型 |
| 類別分佈圖 | ✅ 已實作 | 分類任務顯示各 class 的樣本數 |
| 數值範圍顯示 | ✅ 已實作 | 迴歸任務顯示 min/max/mean/std |
| 連續/離散判斷 | ✅ 已實作 | 自動判斷標籤是連續或離散 |
| 屬性總覽表格 | ✅ 已實作 | 列出所有欄位的 dtype / role / missing% / unique |
| 邊屬性顯示 | ✅ 已實作 | 邊的欄位也列在屬性總覽中 |
| 資料確認閘門 | ✅ 已實作 | 確認 task type + label column 後才能進入訓練 |

### 支援的任務類型

| 任務類型 | 說明 |
|----------|------|
| Node Classification | 節點分類 |
| Node Regression | 節點迴歸 |
| Graph Classification | 圖分類 |
| Graph Regression | 圖迴歸 |

---

## 模型訓練

| 功能 | 狀態 | 說明 |
|------|------|------|
| 自動模式 | ✅ 已實作 | 自動搜尋所有 5 個模型 |
| 手動模型選擇 | ✅ 已實作 | 可勾選特定模型 |
| Optuna HPO | ✅ 已實作 | 自動超參數搜尋（10-300 trials）|
| 訓練時間估算 | ✅ 已實作 | 根據資料大小和歷史紀錄估算 |
| GPU/CPU 偵測 | ✅ 已實作 | 自動偵測並顯示裝置 |
| 背景執行 | ✅ 已實作 | 訓練在 FastAPI BackgroundTasks 中執行 |
| 即時進度 | ✅ 已實作 | 每 2 秒輪詢進度（Polling）|
| 進度條 | ✅ 已實作 | 百分比進度條 + trial 計數器 |
| 經過/剩餘時間 | ✅ 已實作 | 動態計算剩餘時間 |
| 訓練日誌 | ✅ 已實作 | Terminal 風格即時日誌（自動捲動）|
| MLP 警告 | ✅ 已實作 | 資料含邊屬性時提醒 MLP 不使用邊特徵 |
| 實驗歷史 | ✅ 已實作 | 表格列出所有訓練紀錄（trial / model / status / metric / time）|
| 查看歷史結果 | ✅ 已實作 | 可點擊已完成的實驗查看報告 |

### 支援的 GNN 模型

| 模型 | 說明 |
|------|------|
| GCN | Graph Convolutional Network |
| GAT | Graph Attention Network |
| GraphSAGE | Sample and Aggregate |
| GIN | Graph Isomorphism Network |
| MLP | Multi-Layer Perceptron（Baseline，不使用圖結構）|

### 超參數搜尋空間

| 參數 | 範圍 |
|------|------|
| Model | GCN / GAT / GraphSAGE / GIN / MLP |
| Hidden Dimension | 32 / 64 / 128 / 256 |
| Number of Layers | 2 - 5 |
| Dropout | 連續範圍 |
| Learning Rate | 連續範圍 |

---

## 評估與報告

| 功能 | 狀態 | 說明 |
|------|------|------|
| 效能指標（分類）| ✅ 已實作 | Accuracy / F1 Score / Precision / Recall |
| 效能指標（迴歸）| ✅ 已實作 | MSE / MAE / R² Score |
| 分割顯示 | ✅ 已實作 | Train / Validation / Test 三組指標 |
| 混淆矩陣 | ✅ 已實作 | 分類任務顯示（僅支援二元分類 2x2）|
| 殘差圖 | ✅ 已實作 | 迴歸任務的 Actual vs Predicted 散佈圖 |
| 訓練歷程圖 | ✅ 已實作 | Loss + Val Loss 雙軸折線圖，分類額外顯示 Accuracy |
| 最佳配置 | ✅ 已實作 | 表格顯示 best model / hidden_dim / layers / dropout / lr |
| 排行榜 | ✅ 已實作 | Top 100 trials 排名（含金銀銅獎牌 emoji）|
| 查看特定實驗報告 | ✅ 已實作 | 透過 URL query param `?task_id=xxx` 查看歷史報告 |
| 多元分類混淆矩陣 | ❌ 未實作 | 目前硬編碼為 2x2 |
| 模型匯出 | ❌ 未實作 | 無法下載訓練好的模型 |
| 報告匯出 | ❌ 未實作 | 無 PDF/CSV 匯出功能 |

---

## API Endpoints 總覽

### 專案管理

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/api/v1/projects/` | 建立新專案 |
| `GET` | `/api/v1/projects/` | 列出所有專案 |
| `GET` | `/api/v1/projects/{id}` | 取得專案詳情 |
| `DELETE` | `/api/v1/projects/{id}` | 刪除專案 |

### Demo 資料

| Method | Endpoint | 說明 |
|--------|----------|------|
| `GET` | `/api/v1/projects/demo-datasets` | 列出可用 demo 資料集 |
| `GET` | `/api/v1/projects/sample-data` | 下載範例 CSV zip |
| `POST` | `/api/v1/projects/{id}/load-demo` | 載入 demo 資料集 |

### 資料上傳

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/api/v1/projects/{id}/upload` | 上傳 CSV 檔案 |
| `POST` | `/api/v1/projects/{id}/upload-folder` | 上傳資料夾結構 |

### 資料分析

| Method | Endpoint | 說明 |
|--------|----------|------|
| `GET` | `/api/v1/projects/{id}/explore` | 取得資料探索總覽 |
| `GET` | `/api/v1/projects/{id}/columns/{col}` | 單欄位詳細分析 |
| `POST` | `/api/v1/projects/{id}/correlation` | 計算相關矩陣 |
| `POST` | `/api/v1/projects/{id}/validate-label` | 驗證標籤欄位 |
| `POST` | `/api/v1/projects/{id}/impute` | 缺失值填補 |
| `POST` | `/api/v1/projects/{id}/confirm` | 確認資料設定（Step 2 → 3 閘門）|

### 模型訓練

| Method | Endpoint | 說明 |
|--------|----------|------|
| `GET` | `/api/v1/projects/{id}/estimate` | 估算訓練時間 |
| `POST` | `/api/v1/projects/{id}/train` | 啟動訓練 |
| `GET` | `/api/v1/projects/{id}/status` | 取得訓練狀態 |
| `GET` | `/api/v1/projects/{id}/experiments` | 列出訓練紀錄 |

### 報告

| Method | Endpoint | 說明 |
|--------|----------|------|
| `GET` | `/api/v1/projects/{id}/report` | 取得最新報告 |
| `GET` | `/api/v1/projects/{id}/report/{task_id}` | 取得特定訓練的報告 |

### Legacy Endpoints（向後相容）

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/api/v1/upload` | 舊版資料上傳 |
| `GET` | `/api/v1/datasets` | 列出所有 dataset |
| `GET` | `/api/v1/datasets/{id}/explore` | 舊版資料探索 |
| `POST` | `/api/v1/tasks` | 舊版建立訓練任務 |
| `GET` | `/api/v1/tasks` | 列出所有任務 |
| `GET` | `/api/v1/tasks/{id}` | 取得任務狀態 |
| `GET` | `/api/v1/tasks/{id}/report` | 取得任務報告 |

---

## 技術架構

### Frontend

| 項目 | 技術 |
|------|------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Component Library | Ant Design 5.24.2 |
| Charts | Recharts 3.5.1 |
| Animation | Framer Motion 12.23 |
| State Management | React Context (AuthContext, ProjectContext, ColorModeContext) |
| Language | TypeScript 5 |
| Package Manager | npm |
| SSR Support | @ant-design/nextjs-registry 1.0.2 |

### Backend

| 項目 | 技術 |
|------|------|
| Framework | FastAPI |
| ML Framework | PyTorch + PyTorch Geometric (PyG) |
| Training | PyTorch Lightning |
| HPO | Optuna |
| Data Storage | In-memory dict（無資料庫）|
| Python | 3.11 |
| Package Manager | uv |
| Validation | Pydantic v2 |

### 部署

| 項目 | 說明 |
|------|------|
| Frontend Port | 3000 (Next.js dev server) |
| Backend Port | 8000 (Uvicorn) |
| API 通訊 | REST JSON over HTTP |
| CORS | 已啟用 |
| 持久化 | 無（Server 重啟資料遺失）|

---

## 已知限制

### 功能限制

1. **無持久化儲存** — 所有資料存在記憶體中，Server 重啟後全部遺失。MVP 設計，生產環境需整合資料庫。
2. **Mock 認證** — 無真實 SSO 整合，任何人皆可登入。
3. **無路由保護** — 未登入可存取所有頁面。
4. **單一使用者** — 無多使用者支援，所有人共用同一組專案資料。
5. **無模型匯出** — 訓練完成的模型無法下載或部署。
6. **二元混淆矩陣** — 僅支援 2x2 混淆矩陣，多元分類無法正確顯示。
7. **無即時推播** — 訓練進度使用 2 秒 Polling，非 WebSocket。
8. ~~**API URL 硬編碼**~~ — 已修正，fallback URL 改為 `http://localhost:8000`。

### 效能限制

1. **Server 啟動慢** — Mock 資料載入 + PyG 轉換需約 10 秒。
2. **排行榜無分頁** — 100+ trials 時可能渲染緩慢。
3. **大型相關矩陣** — 欄位過多時相關矩陣格子太小難以閱讀。
4. **訓練為同步佇列** — 使用 BackgroundTasks（threadpool），非 Celery/Redis 分散式佇列。

### UI/UX 限制

1. ~~**無深色模式切換按鈕**~~ — 已實作，Header 右側有日/月圖示切換，localStorage 持久化。
2. **無 Loading Skeleton** — 部分頁面已改用 Skeleton（Dashboard、Project Layout），其餘仍顯示 Spinner。
3. ~~**無頁面轉場動畫**~~ — 已實作，使用 Framer Motion fade + slide 動畫。
4. ~~**行動裝置不友善**~~ — 已實作，Drawer 漢堡選單 + 響應式 Header。
5. **Inline Style 為主** — 未充分使用 Ant Design Design Token。
6. **未使用的相依套件** — react-dropzone、react-graph-vis、tailwindcss 已安裝但未使用。

### 配色方案

- **主色調**：淺藍（Cyan `#0891b2`）+ 淺綠（`#10b981`）
- 已移除所有藍紫色漸層（indigo/purple），改用 cyan/green 基調
- 深色模式使用 Ant Design darkAlgorithm，配色自動適配，確保對比度

---

## 待改進項目

詳見 [前端改進報告](./frontend-improvement-report.md)，包含 14 項改進提案，按優先順序分為：

- **P0（Must-have）**: Auth Guard、統一 Header、專案卡片增強、實驗層級架構
- **P1（Should-have）**: 深淺色切換、Loading Skeleton、Dark Mode 相容、API URL 設定、多元混淆矩陣
- **P2（Nice-to-have）**: 頁面轉場、行動裝置 Header、移除未用套件、Empty State、Design Token 重構
