# Excel Ingestion — 技術文件（Phase 1）

## 這次改了什麼

### 新增檔案
- `backend/app/data/excel_spec.py` — `ExcelGraphSpec` dataclass + `parse_parameter_sheet()`
- `backend/app/data/excel_ingestion.py` — `parse_excel_file()`
- `backend/tests/test_excel_ingestion.py` — 16 個 pytest cases
- `backend/tests/test_excel_router.py` — FastAPI TestClient smoke tests
- `frontend/lib/__tests__/api-excel.test.ts` — Jest 測試
- `docs/{changelog,usage,technical}/...` — 3 份新文件
- `.omc/plans/ralplan-excel-upload.md` — consensus plan 紀錄

### 修改檔案
- `backend/app/schemas/api_models.py`：`DatasetSummary` 增加 3 個 optional 欄位（`declared_task_type`、`declared_label_column`、`schema_spec`）。
- `backend/app/routers/projects.py`：新增 `POST /{project_id}/upload-excel` 與 `GET /sample-excel`。
- `backend/pyproject.toml`：加入 `openpyxl>=3.1.0`。
- `frontend/lib/api.ts`：新增 `uploadProjectExcel()`、`downloadSampleExcel()`、`DatasetSummary` 型別擴充、`ExcelSchemaSpec` / `ExcelSchemaEntry` 型別。
- `frontend/app/projects/[id]/upload/page.tsx`：新增 "Upload Excel Template" Card（最頂端），既有 folder 上傳保留為 legacy。

### **不動** 的檔案（Phase 1 邊界）
- `backend/app/data/pyg_converter.py`
- `backend/app/training/pipeline.py`
- `backend/app/models/factory.py`
- `backend/app/data/ingestion.py`, `mock_loader.py`
- 既有 CSV upload endpoints (`/upload`, `/upload-folder`)

## 為什麼這樣做

### 為什麼 Excel 是「另一條上傳路徑」而不是「取代 CSV」
1. 5 個 demo datasets + 既有 pytest / Jest 都綁死在 CSV 格式，硬替換會炸一片綠燈。
2. 訓練 pipeline（`pipeline.py`、`pyg_converter.py`、`models/factory.py`）目前只有 node head，要真正消化 edge/graph Y 得大改。Phase 1 先不動。
3. Spec 被完整 persist 進 dataset record（`declared_task_type`、`declared_label_column`、`schema_spec`），Phase 2 直接從 dataset 讀 schema，**不用使用者再上傳一次**。

### 為什麼 task_type 自動偵測而不是讓使用者在 UI 選
Parameter sheet 裡的 Y 列 **已經宣告了** 預測目標；再讓使用者在前端選一次是冗餘且容易不一致。Upload 成功即直接把 project 推到 `current_step=3 (data_confirmed)`，跳過原本的 Step-2 confirm 頁。

### 為什麼 Phase 1 boundary 是 raise 而不是 warn + downgrade
「靜默降級」（例如 user 填 Edge Y 但系統偷偷改成 node）是 worst-case UX：使用者以為訓的是 A，實際訓的是 B。明確 422 錯誤 + Phase 2 roadmap 訊息讓使用者知道現在限制是什麼、之後會有。

## 怎麼運作的

### 整體流程

```
使用者上傳 .xlsx
       ↓
POST /api/v1/projects/{id}/upload-excel  (routers/projects.py)
       ↓
parse_excel_file(bytes, name)              (data/excel_ingestion.py)
  ├─ openpyxl 讀入所有 sheet
  ├─ parse_parameter_sheet(df)             (data/excel_spec.py)
  │     → 驗證欄位完整、XY ∈ {X,Y}、Level ∈ {Node,Edge,Graph}
  │     → 產出 ExcelGraphSpec
  ├─ _validate_phase1(spec)
  │     → 拒絕多 Type / 多 Y level / Edge Y / 無 Y
  ├─ 讀 Node_{type} / Edge_{type} / Graph_{type} sheet
  ├─ 欄名 normalise：Node → node_id、Source_Node_ID → src_id …
  └─ 推導 task_type：{Node|Graph}_{classification|regression}
       ↓
router 內做 80/20 train/test split（沿用現有邏輯）
       ↓
compute_generic_explore() → explore_stats
       ↓
store.put_dataset(...)  + update_project(step=3)
       ↓
return DatasetSummary（含 declared_task_type/label_column/schema_spec）
       ↓
前端跳到 /projects/{id}/explore
```

### 模組關係圖

```
┌────────────────────────┐
│  routers/projects.py   │  新增 upload-excel + sample-excel
└─────────┬──────────────┘
          │ 呼叫
          ▼
┌────────────────────────┐      ┌────────────────────────┐
│  data/excel_ingestion  │──使用→│  data/excel_spec       │
└─────────┬──────────────┘      └────────────────────────┘
          │ 輸出 DataFrame + task_type + label_column
          ▼
┌────────────────────────┐
│  data/feature_         │  沿用現有 explore stats
│  engineering.py        │
└────────────────────────┘
          │
          ▼
┌────────────────────────┐
│  core/store.py         │  persist dataset record
└────────────────────────┘
```

### 欄名 normalisation 對照表

| Excel template 原欄名      | 後端/既有 CSV 慣例  |
|----------------------------|---------------------|
| `Node`                     | `node_id`           |
| `Source_Node_ID`           | `src_id`            |
| `Target_Node_ID`           | `dst_id`            |
| `Graph_ID`                 | `_graph`            |
| 其餘欄（`X_1`, `label` 等）| 原樣保留             |

Normalisation 在 `_normalise_node_sheet()` / `_normalise_edge_sheet()` 內完成，大小寫不敏感。

### Task type 自動偵測規則

`_infer_task_kind(series)`：

```
clean = pd.to_numeric(series, errors='coerce').dropna()
if clean is empty:
    return 'classification'       # 非數值 → 分類
if all(values are integer) and nunique <= 20:
    return 'classification'
else:
    return 'regression'
```

結合 Y Level 得到最終 `task_type`：
- Node Y → `node_classification` / `node_regression`
- Graph Y → `graph_classification` / `graph_regression`

## 怎麼使用（開發者）

### 後端單獨呼叫 parser

```python
from app.data.excel_ingestion import parse_excel_file

with open("my_data.xlsx", "rb") as f:
    result = parse_excel_file(f.read(), "my-dataset")

result["spec"]          # ExcelGraphSpec
result["nodes_df"]      # pandas.DataFrame with node_id column
result["edges_df"]      # pandas.DataFrame with src_id/dst_id
result["graph_df"]      # Optional[pd.DataFrame]
result["task_type"]     # "node_classification" 等
result["label_column"]  # Y 欄名
result["label_weight"]  # float（Phase 1 僅儲存）
```

### 前端呼叫 API

```typescript
import { uploadProjectExcel } from '@/lib/api';

const summary = await uploadProjectExcel(projectId, file, 'my-data');
// summary.declared_task_type, summary.declared_label_column
router.push(`/projects/${projectId}/explore`);
```

## 注意事項

### 已知限制
- `openpyxl` 是唯讀取 .xlsx 的 engine，.xls 不支援。
- 目前讀 workbook 使用 `pandas.read_excel(sheet_name=None)` → 全部 sheet 一次載入記憶體。極大檔案（> 10 萬 node）未最佳化。Phase 2 評估改用 `openpyxl` 的 read-only iterator。
- `Weight` 欄目前只存入 `label_weight`，訓練時並未使用（`pipeline.py` 未改）。Phase 2 引入 multi-task loss 時會消費。
- Node id 型別：template 的 `Node` 欄若混用字串與整數，下游 `dataframes_to_pyg_dynamic` 的 id → idx 對應仍以既有 heuristic 處理，behaviour 跟 CSV 上傳一致。

### Phase 2 路標
| 能力                                       | 需修改的檔                                                           |
|--------------------------------------------|----------------------------------------------------------------------|
| Edge-level prediction                      | `models/factory.py` (新 edge head)、`pyg_converter`、`pipeline`       |
| Multi-task weighted loss (消費 Weight)     | `pipeline.py`、`models/*.py`（loss combine）                          |
| Heterogeneous graphs（多 Type）            | 改用 `torch_geometric.data.HeteroData`；`pyg_converter` 新增路徑      |
| 串流讀取大 .xlsx                           | `excel_ingestion.py` 改用 `openpyxl.load_workbook(read_only=True)`   |

### 測試覆蓋
```bash
cd backend && pytest tests/test_excel_ingestion.py tests/test_excel_router.py -v
cd frontend && npx jest api-excel.test.ts
```

Phase 1 backend 新模組 16 個 pytest cases 覆蓋：
- Parameter sheet 正例 / 缺欄 / 無效 XY / 無效 Level / 空行跳過 / Weight 非數值
- 全檔：Node classification / Graph regression / 缺 Parameter sheet / Edge Y 拒絕 / 多 Y 拒絕 / 多 Type 拒絕 / 無 Y 拒絕 / 缺資料 sheet / label 欄不存在 / 連續值 → regression
