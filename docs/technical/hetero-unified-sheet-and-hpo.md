# 技術文件：異質圖統一 Excel 格式 + Graph-level HPO

**版本**：2026-04-24
**相關 commit**：見 `docs/changelog/2026-04-24-hetero-unified-sheet-and-hpo-fix.md`

## 這次改了什麼（What Changed）

### 後端核心

| 檔案 | 變更類型 | 摘要 |
|------|----------|------|
| `backend/app/data/excel_ingestion.py` | 修改 | `_resolve_all` 優先讀統一 `Node`/`Edge`/`Graph` sheet，再以 `Type` 欄 split；legacy per-type sheet 仍相容 |
| `backend/app/data/feature_engineering.py` | 修改 | 抽出 `_column_entries` helper；`compute_generic_explore` 支援 `node_dfs` / `edge_dfs`，per-type 統計避免跨型別 NaN 汙染 |
| `backend/app/routers/projects.py` | 修改 | `_store_excel_dataset`、`impute_missing_endpoint` 傳入 per-type dfs；feature count 去重 |
| `backend/app/training/optuna_search.py` | 重寫 | `run_hpo` 支援 node / graph homo / graph hetero；回傳 `completed_trials`；hetero 走 `HETERO_BACKBONES`（gcn/gat/sage） |
| `backend/app/training/pipeline.py` | 修改 | 所有任務類型統一呼叫 HPO；PREPROCESSING 階段即送出 `total_trials`；progress 50% 時同步 `current_trial` |
| `backend/scripts/generate_excel_demos.py` | 修改 | 產生新格式 demo 檔 |

### Demo 資料

- `backend/demo_data/demo_multigraph_homo.v2.xlsx` — 單一 `Node`/`Edge`/`Graph` sheet
- `backend/demo_data/demo_multigraph_hetero.v2.xlsx` — 單一 sheet + Type 欄分 cell/pin/net + cell2pin/pin2pin/pin2net

### 測試

- `backend/tests/test_excel_ingestion.py` — 新增 3 個測試覆蓋統一 sheet 格式與錯誤情境
- `backend/tests/test_explore_hetero.py` — 新檔；per-type missing 計算的回歸測試
- `backend/tests/test_demo_data.py` — 新檔；demo 檔 smoke test

## 為什麼這樣做（Why）

### 1. 異質圖 Explore「feature missing」問題

用戶反映上傳異質圖後，Explore 頁面所有 feature 都顯示 ~66% 缺失。

根因：`_store_excel_dataset` 會做 `unified_nodes = pd.concat(list(node_dfs.values()))`，把 cell / pin / net 三個 DataFrame 垂直合併後傳給 `compute_generic_explore`。`cell_area` 只在 cell rows 有值，pin/net rows 都是 NaN，因此 `nodes_df["cell_area"].isna().mean()` ≈ 0.66。

**修正策略**：`compute_generic_explore` 增加 per-type 支援。當傳入 `node_dfs`（dict），走 per-type path，每個 feature 的 denominator 就是「該型別列數」而非「全部列數」。同時每個 column entry 帶上 `node_type` 欄，前端可群組顯示。

### 2. Excel 單一 sheet 格式

舊格式強迫用戶依型別拆 sheet，不符合「一個圖資料」的直覺，且擴充型別時要新增 sheet。

**新設計**：沿用 Parameter sheet 作為「feature ↔ type」對應的 single source of truth。資料 sheet 只需要 `Type` 欄 + feature 欄。若某列不屬於某 feature 的型別，留空即可。

關鍵實作：`_split_unified_by_type` 會在切片時，把「本型別未宣告、但其他型別宣告」的欄位直接 drop，避免下游 `_numeric_feature_columns` 把它們當成該型別的 NaN feature。

### 3. Graph-level 任務只跑 1 個 trial

原本 `pipeline.py` 的 HPO 分支只涵蓋 `not is_graph_task`（節點任務）。graph-level 任務直接用 `{"model_name": "sage", "hidden_dim": 64, ...}` 寫死，跑 1 次完整訓練，UI 的 Trial X/N 因此永遠是 0/N。

**修正策略**：
1. 重寫 `run_hpo` 讓它同時接受 `Data`（node）、`list[Data]`（graph homo）、`list[HeteroData]`（graph hetero）；`metadata` 非 None 就自動切 hetero path，只用 `HETERO_BACKBONES = ("gcn","gat","sage")`（GIN/MLP 在 `to_hetero` 下不穩）。
2. `pipeline.py` 移除 graph-level 的 if-else，統一呼叫 HPO。
3. `PREPROCESSING` 一開始就把 `total_trials` 寫回 task store，避免 UI 空白。
4. HPO 結束時把 `current_trial = completed_trials` 寫入，提示「Trial X/N 完成」。

## 怎麼運作的（How It Works）

### 讀入流程

```
upload-excel
  ↓
parse_excel_file
  ↓
  load workbook
  ↓
  parse Parameter sheet → ExcelGraphSpec (定義型別)
  ↓
  _resolve_all("Node")
    ├─ 若 workbook 有 "Node" sheet → _split_unified_by_type
    │    · 依 Type 欄切成 {cell: df, pin: df, net: df}
    │    · drop 「其他型別宣告、本型別未宣告」的 column
    └─ 否則 fallback 到 Node_cell / Node_pin / Node_net
  ↓
  同理 _resolve_all("Edge") / _resolve_all("Graph")
  ↓
  _normalise_*_sheet → node_dfs / edge_dfs (per-type dict)
  ↓
  pd.concat → unified_nodes / unified_edges (for homo + explore 呈現)
```

### Explore 分型別統計

```
_store_excel_dataset (routers/projects.py)
  ↓
  compute_generic_explore(
      nodes_df, edges_df,
      node_dfs={cell: df, pin: df, net: df},  ← 新增
      edge_dfs={c2p: df, p2p: df, p2n: df},   ← 新增
  )
  ↓
  if node_dfs:
      for type_name, df in node_dfs.items():
          # 每欄的 missing 相對於 len(df)，不再拿合併後的總列數當分母
          columns.extend(_column_entries(df, NODE_COL_SKIP,
                                         type_name=type_name,
                                         source="node"))
```

### Training HPO 整合

```
run_training_task (pipeline.py)
  ↓
  PREPROCESSING phase
    ├─ update_task(total_trials=n_trials, current_trial=0)
    └─ 準備 train_items / val_items / test_items / metadata
  ↓
  run_hpo(train_items, val_items, metadata=...)
    ↓
    每個 trial:
      ├─ Optuna suggest model / hidden / layers / dropout / lr
      ├─ get_model(..., metadata=metadata)  ← hetero 時走 HeteroGraphRegressor
      ├─ _build_loaders(train_items, val_items)
      │    · list[Data|HeteroData] → batch_size=min(8,N), shuffle
      │    · Data (node-level) → batch_size=1
      ├─ Trainer(callbacks=[EarlyStopping(val_loss)], MAX_HPO_EPOCHS)
      └─ TrialProgressCallback(task_id, n_trials)
           └─ 每 trial 結束 → update_task(current_trial, progress)
  ↓
  Final train with best config → ModelCheckpoint / metrics / report
```

### 模組關係圖

```
┌────────────────────────────────────────────────────────┐
│ Frontend (Next.js)                                      │
│  projects/[id]/upload   → POST /projects/{id}/upload-excel
│  projects/[id]/explore  → GET  /projects/{id}/explore   │
│  projects/[id]/train    → POST /projects/{id}/train     │
│                          → GET  /projects/{id}/status   │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ FastAPI routers/projects.py                            │
│  _store_excel_dataset ─┐                                │
│  explore_project_data  │                                │
│  start_training        │                                │
└────────────────────────┼────────────────────────────────┘
            ┌────────────┼────────────┬─────────────────┐
            ▼            ▼            ▼                 ▼
       data/excel_    data/feature_  training/    training/
       ingestion.py   engineering.py pipeline.py  optuna_search.py
       (read + split) (explore stats)(orchestrate)(HPO unified)
                                           │
                                           ▼
                                 data/pyg_converter{,_hetero}.py
                                 + models/factory.py + models/*.py
```

## 怎麼使用（Usage）

### 產出新 demo Excel

```bash
cd backend
uv run python scripts/generate_excel_demos.py
```

### 最小 hetero 範例（Python code）

```python
import io
import pandas as pd
from app.data.excel_ingestion import parse_excel_file

parameter = pd.DataFrame([
    {"XY": "X", "Level": "Node", "Type": "cell", "Parameter": "cell_area"},
    {"XY": "X", "Level": "Node", "Type": "pin",  "Parameter": "pin_cap"},
    {"XY": "X", "Level": "Edge", "Type": "cell2pin", "Parameter": "delay"},
    {"XY": "Y", "Level": "Graph","Type": "default", "Parameter": "score"},
])
nodes = pd.DataFrame([
    {"Graph_ID": 1, "Node": 0, "Type": "cell", "cell_area": 1.2, "pin_cap": None},
    {"Graph_ID": 1, "Node": 1, "Type": "pin",  "cell_area": None, "pin_cap": 0.5},
])
edges = pd.DataFrame([
    {"Graph_ID": 1, "Source_Node_ID": 0, "Target_Node_ID": 1,
     "Source_Node_Type": "cell", "Target_Node_Type": "pin",
     "Type": "cell2pin", "delay": 3.14},
])
graph = pd.DataFrame({"Graph_ID": [1], "Type": ["default"], "score": [1.5]})

buf = io.BytesIO()
with pd.ExcelWriter(buf, engine="openpyxl") as w:
    parameter.to_excel(w, "Parameter", index=False)
    nodes.to_excel(w, "Node", index=False)
    edges.to_excel(w, "Edge", index=False)
    graph.to_excel(w, "Graph", index=False)

result = parse_excel_file(buf.getvalue())
assert result["is_heterogeneous"]
assert set(result["node_dfs"]) == {"cell", "pin"}
```

### 查看 HPO 進度

Training 開始後輪詢 `GET /projects/{id}/status`：

```json
{
  "status": "TRAINING",
  "progress": 37,
  "current_trial": 12,
  "total_trials": 150,
  "device": "cuda (NVIDIA ..., CUDA 12.1)"
}
```

## 注意事項（Caveats）

1. **Parameter sheet 仍是「哪個 feature 屬於哪個 type」的唯一來源**；統一 sheet 裡即使 `cell_area` 欄位對 pin 列留空，如果 Parameter 沒宣告 `(Node, pin, cell_area)`，它永遠不會被認成 pin 的 feature。
2. **同名 feature 跨型別共用欄位**：若 `cell_area` 在 Parameter 同時宣告為 cell 與 net 的 feature，統一 sheet 的 `cell_area` 欄對 cell rows、net rows 都會保留並作為該型別的 feature；pin rows 仍會被 drop。
3. **HPO timeout**：原本 node-level `study.optimize(timeout=600)`，graph-level 任務每 trial 要跑到 `MAX_HPO_EPOCHS=15` 才收斂，timeout 改為 `None`（由 `n_trials` 和 `EarlyStopping` 控制）。
4. **Heterogeneous backbones**：HPO 在 hetero 路徑只挑 `gcn / gat / sage`；MLP/GIN 在 `to_hetero` 下不穩或無邊資訊。
5. **Precision**：`settings.PRECISION` 預設 `16-mixed`；若 GPU 不支援可在 `app/core/config.py` 改成 `32-true`。
6. **舊 demo 檔**：若 Excel 仍在系統中被開啟，`scripts/generate_excel_demos.py` 會 skip 覆寫未版本化的 `.xlsx`，`.v2.xlsx` 仍會成功產生。
