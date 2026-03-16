# LayoutXpert 系統使用指南

**版本：** 0.2.0
**最後更新：** 2026-03-17

---

## 目錄

1. [系統概覽](#1-系統概覽)
2. [快速開始](#2-快速開始)
3. [專案管理 (Dashboard)](#3-專案管理-dashboard)
4. [Step 1：資料上傳](#4-step-1資料上傳)
5. [Step 2：資料分析](#5-step-2資料分析)
6. [Step 3：模型訓練](#6-step-3模型訓練)
7. [Step 4：模型評估](#7-step-4模型評估)
8. [模型註冊中心 (Model Registry)](#8-模型註冊中心-model-registry)
9. [支援的 GNN 模型](#9-支援的-gnn-模型)
10. [資料格式規範](#10-資料格式規範)
11. [技術架構](#11-技術架構)

---

## 1. 系統概覽

LayoutXpert 是一套 **GNN (圖神經網路) AutoML 平台**，專為晶片佈局與 EDA (Electronic Design Automation) 資料設計。

### 核心流程

```
上傳電路圖資料  →  資料分析  →  AutoML 訓練  →  模型評估  →  模型管理
(nodes + edges CSV)   (探索、清洗)   (Optuna HPO)   (指標、圖表)   (Registry)
```

### 主要特性

| 特性 | 說明 |
|------|------|
| 無需資料庫 | 純 In-Memory 儲存，零設定啟動 |
| 自動特徵處理 | 自動偵測 numeric / categorical 欄位，categorical 自動 one-hot encoding |
| AutoML | Optuna 超參數搜尋，支援 10–300 trials |
| 多圖支援 | 單一專案可載入多個電路圖 (Multi-Graph) |
| 任務彈性 | 支援節點分類、節點迴歸、圖分類、圖迴歸四種任務 |
| CPU / GPU | 自動偵測裝置，支援 CUDA 加速 |

---

## 2. 快速開始

### 2.1 啟動服務

**後端 (Backend)**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**前端 (Frontend)**

```bash
cd frontend
npm install
npm run dev
# 開啟 http://localhost:3000
```

### 2.2 五分鐘體驗流程

1. 開啟瀏覽器，前往 `http://localhost:3000`
2. 點擊 **New Project**，輸入專案名稱後建立
3. 在 **Upload Data** 頁面點擊任一 Demo 資料集的 **Load** 按鈕（建議先用 **Basic Circuit**）
4. 系統自動跳轉至 **Data Analysis** 頁面
5. 選擇 **Task Type**（例如 `Node Classification`）與 **Label Column**（例如 `label`）
6. 確認驗證通過後，點擊 **Confirm & Proceed to Training**
7. 在訓練頁面，保持 Auto 模式，調整 Trials 數量後按 **Start Training**
8. 訓練完成後點擊 **View Latest Results** 查看評估報告
9. 前往 **Model Registry** 管理已訓練的模型

---

## 3. 專案管理 (Dashboard)

Dashboard 是系統的起始頁面，列出所有專案並提供管理功能。

### 3.1 建立專案

1. 點擊右上角 **New Project** 按鈕
2. 輸入專案名稱（必填）
3. 可選填標籤（Tags），輸入後按 Enter 新增，支援多標籤
4. 點擊 **Create**

### 3.2 搜尋與過濾

- **搜尋**：頂部搜尋欄，依專案名稱即時過濾
- **標籤過濾**：點擊任一標籤，只顯示含有該標籤的專案

### 3.3 專案卡片資訊

每張專案卡片顯示：

| 欄位 | 說明 |
|------|------|
| 名稱 | 專案名稱 |
| 狀態標籤 | `created` / `data_uploaded` / `data_confirmed` / `training` / `completed` / `failed` |
| 目前步驟 | Upload / Analysis / Training / Evaluation（四步驟進度） |
| 最後更新時間 | 相對時間（例如 `3h ago`） |
| Tags | 彩色標籤 |

### 3.4 編輯與刪除

- 點擊卡片上的 **編輯圖示**（鉛筆）可修改專案名稱
- 點擊 **刪除圖示**（垃圾桶）並確認後永久刪除專案

### 3.5 繼續進行中的專案

點擊專案卡片，系統依據目前步驟自動跳轉至對應頁面：

- `created` / Step 1 → Upload 頁面
- Step 2 → Data Analysis 頁面
- Step 3 → Training 頁面
- `completed` → Evaluation 頁面

---

## 4. Step 1：資料上傳

### 4.1 三種上傳方式

#### 方式一：Demo 資料集（推薦新手）

頁面頂部顯示 4 個內建 Demo 資料集，點擊 **Load** 即可一鍵載入：

| Demo ID | 名稱 | 節點數 | 邊數 | 說明 |
|---------|------|--------|------|------|
| `basic` | Basic Circuit | 400 | 800 | 乾淨資料，適合初次體驗節點分類 |
| `edge_attrs` | Edge Attributes | 330 | 660 | 含邊特徵（routing layer、resistance、coupling capacitance） |
| `multigraph` | Multi-Graph | 350 | 700 | 3 張獨立電路圖（graph_A / graph_B / graph_C） |
| `dirty` | Dirty Data | 400 | 800 | 含約 5% 缺失值、離群值、混合型別欄位，用於測試資料清洗流程 |

#### 方式二：資料夾上傳（主要上傳方式）

點擊 **Select Project Folder** 選取整個資料夾。系統會自動掃描資料夾內的 CSV 檔案並辨識圖結構。

**必要資料夾結構：**

```
project_folder/
  graph_A/
    nodes_train.csv    (必要)
    edges_train.csv    (必要)
    nodes_test.csv     (選用)
    edges_test.csv     (選用)
  graph_B/
    nodes_train.csv
    edges_train.csv
    ...
```

> **單圖上傳：** 若資料夾內直接放 CSV 而不含子資料夾，系統會將其視為單一圖處理。

- 上傳前可輸入 **Dataset Name**（選填），若留空則自動取自資料夾名稱
- 系統偵測到有效圖（含 `nodes_train.csv` + `edges_train.csv`）才允許上傳
- 每個偵測到的圖以綠色（有效）或紅色（無效）標示

#### 方式三：下載範例 CSV

點擊 **Sample CSV** 按鈕下載範例檔案，參考欄位格式後自行準備資料。

---

## 5. Step 2：資料分析

資料分析頁面分為四個區塊。

### 5.1 I. Graph Topology（圖拓撲概覽）

- 顯示總節點數與總邊數
- **相關性熱力圖**：勾選數值欄位（至少兩個）後即時計算 Pearson 相關係數，以熱力圖呈現
  - 正相關：藍色；負相關：紅色；顏色深淺代表相關程度

### 5.2 II. Node Analysis（節點欄位分析）

從下拉選單選擇任一欄位，系統顯示：

**數值欄位（Numeric）：**

| 統計量 | 說明 |
|--------|------|
| Mean / Median / Std | 中心趨勢與離散度 |
| Min / Max / Q1 / Q3 | 極值與四分位數 |
| Outlier Count | 離群值數量（以 IQR 方法偵測） |
| 分佈直方圖 | 區間計數長條圖 |

**類別欄位（Categorical）：**

- 最高頻值與次數
- 水平長條圖（超過 50 個唯一值時跳過圖表，避免效能問題）

**型別覆寫：** 系統自動偵測欄位型別，可透過 Segmented 控制項手動切換為 Numeric 或 Categorical。

**缺失值處理：**

若欄位含缺失值，會顯示黃色警告並提供補值選項：

| 方法 | 說明 |
|------|------|
| Mean | 以平均值填補（數值欄位） |
| Median | 以中位數填補（數值欄位） |
| Zero | 以 0 填補 |

選擇方法後點擊 **Fill** 即立即套用並更新統計資料。

### 5.3 III. Label & Target Analysis（標籤設定）

選擇學習任務與標籤欄位，系統即時驗證相容性：

**支援的任務類型：**

| Task Type | 說明 |
|-----------|------|
| `node_classification` | 節點分類 |
| `node_regression` | 節點迴歸 |
| `graph_classification` | 圖分類（Multi-Graph） |
| `graph_regression` | 圖迴歸（Multi-Graph） |

- 分類任務：顯示類別數量與類別分佈長條圖
- 迴歸任務：顯示數值範圍（Min / Max / Mean / Std）及連續/離散判斷

驗證通過（綠色 Alert）後，點擊 **Confirm & Proceed to Training** 進入下一步。

### 5.4 IV. Attribute Summary（屬性摘要）

列出所有欄位的完整摘要表，包含：

- 欄位名稱、型別（numeric / categorical）
- 角色（feature / label / id / edge_attr）
- 缺失值數量與百分比
- 唯一值數量

---

## 6. Step 3：模型訓練

### 6.1 訓練設定

#### 模型選擇

| 模式 | 說明 |
|------|------|
| **Auto（預設）** | 自動搜尋全部 5 種 GNN 模型（GCN、GAT、GraphSAGE、GIN、MLP） |
| **手動** | 關閉 Auto 開關後，勾選想要的模型組合 |

> **注意：** 若資料含邊特徵（edge attributes），選用 MLP 時會顯示警告，因為 MLP 不使用邊特徵。

#### Optuna Trials 設定

透過滑桿設定超參數搜尋的 Trial 數量：

- 範圍：**10 ~ 300**
- 預設：**150**
- Trials 越多，找到最優超參數的機率越高，但訓練時間也越長

#### 訓練時間估算

系統在設定 Trials 數量後自動估算訓練時間，並顯示使用的運算裝置（CPU 或 CUDA GPU）。

### 6.2 啟動訓練

點擊 **Start Training** 後，右側面板即時顯示：

- 進度條（百分比）
- 已用時間 / 預估剩餘時間
- 目前 Trial 編號（Trial X / Total）
- 運算裝置（CPU / CUDA）
- 訓練日誌（Terminal Log）：顯示狀態變化時間戳記

**訓練狀態流程：**

```
QUEUED → PREPROCESSING → TRAINING → COMPLETED / FAILED
```

### 6.3 實驗歷史

同一專案的每次訓練都會記錄為一筆 Experiment，顯示於頁面下方的 **Experiment History** 表格，包含：

- 模型名稱、狀態、指標（Accuracy 或 MSE）、訓練時間、日期
- 點擊已完成的實驗可跳轉查看對應的評估報告

---

## 7. Step 4：模型評估

訓練完成後，Evaluation 頁面展示完整的模型報告。

### 7.1 效能指標

#### 分類任務

| 指標 | 說明 |
|------|------|
| Accuracy | 整體正確率 |
| F1 Score | 精確率與召回率的調和平均 |
| Precision | 精確率 |
| Recall | 召回率 |

訓練集（Train）、驗證集（Val）與測試集（Test）各自獨立顯示。

#### 迴歸任務

| 指標 | 說明 |
|------|------|
| MSE | 均方誤差 |
| MAE | 平均絕對誤差 |
| R² Score | 決定係數（越接近 1 越好） |

### 7.2 視覺化圖表

| 圖表 | 適用任務 | 說明 |
|------|----------|------|
| 訓練歷史曲線 | 分類 / 迴歸 | Loss 與 Accuracy 隨 Epoch 變化折線圖 |
| 混淆矩陣 | 分類 | 動態 N×N 矩陣；對角線（正確預測）以綠色標示，非對角線（錯誤）以紅色標示 |
| 殘差圖 | 迴歸 | Actual vs. Predicted 散佈圖 |

### 7.3 HPO 排行榜

顯示 Top 10 Optuna Trials 的超參數組合與對應的 Validation Loss：

| 欄位 | 說明 |
|------|------|
| Trial | Trial 編號 |
| Model | 模型類型 |
| Hidden Dim | 隱藏層維度 |
| Layers | 層數 |
| Dropout | Dropout 比率 |
| LR | 學習率 |
| Val Loss | 驗證損失 |

### 7.4 Best Model Configuration

顯示最佳 Trial 的完整超參數設定（模型、Hidden Dim、層數、Dropout、學習率）。

---

## 8. 模型註冊中心 (Model Registry)

每次訓練完成後，系統自動將最佳模型儲存至 **Model Registry**。

### 8.1 功能概覽

點擊訓練完成後的 **Model Registry** 按鈕，或從專案頁面側邊欄進入。

每筆模型記錄顯示：

- 模型名稱、GNN 類型標籤、任務類型
- 主要指標（分類：Accuracy；迴歸：R²）
- 特徵維度、類別數、標籤欄位
- 註冊日期

### 8.2 各項操作

#### 查看詳細資訊

點擊 **詳細資訊圖示（i）**，彈出視窗顯示：

- 模型完整設定（Model、Task Type、Label Column、Features、Classes）
- Best Configuration（Hidden Dim、Layers、Dropout、Learning Rate）
- 訓練集與測試集各項指標

#### 編輯模型資訊

點擊 **編輯圖示（鉛筆）** 可修改：

- 模型名稱
- 模型描述（自由文字）

#### 以新資料評估模型

點擊 **Evaluate** 按鈕，可上傳新的 CSV 資料對已訓練模型進行推論與評估：

1. 上傳 **Nodes CSV** 與 **Edges CSV**（格式須與訓練資料相同，含標籤欄位）
2. 點擊 **Run Evaluation**
3. 結果顯示：
   - 樣本數量
   - 完整效能指標
   - 分類任務：混淆矩陣
   - 迴歸任務：殘差圖（Actual vs. Predicted）

> **注意：** 上傳的資料必須包含與訓練時相同的特徵欄位與標籤欄位。

#### 刪除模型

點擊 **刪除圖示（垃圾桶）** 並確認，永久移除模型檔案與記錄。

---

## 9. 支援的 GNN 模型

| 模型 | 全名 | 說明 |
|------|------|------|
| **GCN** | Graph Convolutional Network | 最基礎的圖卷積網路，以鄰居節點特徵做加權平均聚合 |
| **GAT** | Graph Attention Network | 引入注意力機制，對不同鄰居賦予不同權重 |
| **GraphSAGE** | Sample and Aggregate | 透過取樣鄰居做聚合，適合大規模圖結構 |
| **GIN** | Graph Isomorphism Network | 理論上具有最強圖判別能力（與 WL-test 等價） |
| **MLP** | Multi-Layer Perceptron | 僅使用節點特徵，不考慮圖結構，作為 baseline |

所有模型皆支援節點級別（Node-level）與圖級別（Graph-level）任務，並接受邊特徵（Edge Attributes）作為輸入（MLP 除外）。

**Optuna 自動搜尋的超參數範圍：**

| 超參數 | 搜尋範圍 |
|--------|----------|
| `hidden_dim` | 16, 32, 64, 128, 256 |
| `num_layers` | 1 ~ 4 |
| `dropout` | 0.0 ~ 0.5 |
| `lr` (learning rate) | 1e-4 ~ 1e-2 |

---

## 10. 資料格式規範

### 10.1 Nodes CSV

每個圖的節點資料，必須包含以下欄位：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `node_id` | integer / string | **必要**，節點唯一識別碼 |
| 特徵欄位 | numeric / categorical | 任意數量的節點特徵 |
| 標籤欄位 | numeric / string | 學習目標（Step 2 中選擇） |

**範例（節點分類）：**

```csv
node_id,fanout,slack,cell_type,label
0,3,0.12,INV,0
1,5,-0.03,NAND,1
2,2,0.45,BUF,0
```

### 10.2 Edges CSV

每個圖的邊資料，必須包含以下欄位：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `src_id` | integer / string | **必要**，來源節點 ID |
| `dst_id` | integer / string | **必要**，目標節點 ID |
| 邊特徵欄位 | numeric | 選用，任意數量的邊屬性 |

**範例（含邊特徵）：**

```csv
src_id,dst_id,resistance,coupling_cap,routing_layer
0,1,0.05,0.002,1
1,2,0.08,0.003,2
2,3,0.04,0.001,1
```

### 10.3 自動特徵處理規則

| 情況 | 處理方式 |
|------|----------|
| 數值欄位 | 直接使用為特徵 |
| 類別欄位（≤ 20 個唯一值） | 自動 One-Hot Encoding |
| 類別欄位（> 20 個唯一值） | 跳過（不作為特徵） |
| 布林欄位 | 視為類別欄位處理 |
| 缺失值 | 建議在 Step 2 補值；未補值的數值欄位預設填 0 |

### 10.4 Train / Test 分割

- 提供 `nodes_train.csv` + `edges_train.csv` 作為訓練集
- 可選提供 `nodes_test.csv` + `edges_test.csv` 作為測試集
- 若不提供測試集，系統自動從訓練集切分（80/20）

---

## 11. 技術架構

### 11.1 技術堆疊

| 層次 | 技術 |
|------|------|
| **後端框架** | Python 3.x + FastAPI |
| **GNN 框架** | PyTorch + PyTorch Geometric (PyG) |
| **超參數優化** | Optuna |
| **前端框架** | Next.js 15 (App Router) |
| **UI 元件庫** | Ant Design 5.x |
| **圖表** | Recharts |
| **儲存** | In-Memory（無需資料庫） |

### 11.2 API 端點概覽

服務啟動後，可至 `http://localhost:8000/docs` 查看完整的互動式 API 文件（Swagger UI）。

主要端點前綴：

```
GET  /api/v1/projects/demo-datasets      列出 Demo 資料集
GET  /api/v1/projects/sample-data        下載範例 CSV

POST /api/v1/projects                    建立專案
GET  /api/v1/projects                    列出所有專案
GET  /api/v1/projects/{id}               取得專案詳情
PUT  /api/v1/projects/{id}               更新專案
DELETE /api/v1/projects/{id}             刪除專案

POST /api/v1/projects/{id}/upload-folder  上傳資料夾
POST /api/v1/projects/{id}/load-demo      載入 Demo 資料
GET  /api/v1/projects/{id}/explore        取得探索資料
POST /api/v1/projects/{id}/impute         補值
POST /api/v1/projects/{id}/confirm-data   確認資料設定

POST /api/v1/projects/{id}/training/start 啟動訓練
GET  /api/v1/projects/{id}/training/status 查詢訓練狀態
GET  /api/v1/projects/{id}/report         取得評估報告

GET  /api/v1/projects/{id}/models         列出已註冊模型
POST /api/v1/projects/{id}/models/{mid}/evaluate 評估模型
PUT  /api/v1/projects/{id}/models/{mid}   更新模型資訊
DELETE /api/v1/projects/{id}/models/{mid} 刪除模型
```

### 11.3 資料流

```
CSV 上傳
    ↓
parse_csv_pair_generic()          # 解析 nodes + edges CSV
    ↓
dataframes_to_pyg_dynamic()       # 轉換為 PyG Data 物件
    ↓                              # (自動偵測欄位型別、one-hot encoding)
In-Memory Store (datasets{})
    ↓
run_training_task() [背景執行緒]
    ↓
Optuna Study                      # 超參數搜尋
    ↓                              # 逐 trial 訓練各 GNN 模型
Best Model 選出
    ↓
Model Registry (models{})         # 儲存模型權重與 metadata
    ↓
Report 生成                        # 指標、混淆矩陣、殘差圖、Leaderboard
```

### 11.4 注意事項

- **記憶體揮發性：** In-Memory 儲存不持久化，重啟後資料消失。若需保留模型，請在關閉服務前備份模型檔案。
- **並發訓練：** 同一時間每個專案只能有一個訓練任務進行。
- **CORS 設定：** 預設允許 `localhost:3000`，若需其他來源請修改 `backend/app/main.py` 的 `allow_origins`。
- **GPU 支援：** 系統自動偵測 CUDA，若無 GPU 則回退至 CPU。GPU 可大幅縮短訓練時間。
