# Changelog — 2026-04-24 · Hetero unified Excel + HPO for graph tasks

## 修復項目

1. **[Bug] 異質圖在 Explore 階段顯示「feature missing」**
   - 根因：`compute_generic_explore` 以合併後的 `nodes_df` 計算缺失值；cell/pin/net 三種節點被 concat 後，cell 特徵欄位在 pin/net 的列會是 NaN，造成 UI 顯示 66%+ 缺失。
   - 修正：`compute_generic_explore` 新增 `node_dfs` / `edge_dfs` 參數；異質圖改為逐型別計算（denominator = 該型別的列數）。

2. **[Feature] Excel 新版統一格式（單一 Node / Edge sheet）**
   - 取代舊的每型別一個 sheet（`Node_cell`、`Node_pin`、`Node_net`…）。
   - 新格式：`Node` 單一 sheet + `Type` 欄位區分子型別，所有 feature 放在同一欄；不屬於該型別的 feature 直接留空。
   - `Edge`、`Graph` sheet 同理。
   - 向下相容：若工作簿只有舊格式 `Node_{type}` sheet，仍可正常讀取。

3. **[Bug] Training 只跑一個 trial 且 trial 顯示不正確**
   - 根因：`pipeline.py` 對 graph-level 任務完全跳過 `run_hpo`，直接用固定 `(sage, hidden=64, lr=1e-3)`，因此 UI 的 Trial X/N 始終是 0/N。
   - 修正：`run_hpo` 擴充支援 `list[Data]`（graph homo）與 `list[HeteroData]`（graph hetero，透過 `metadata`）；pipeline 對所有任務類型統一呼叫 HPO，每次 trial 完成都即時更新 `current_trial`。

## 變更檔案

- `backend/app/data/excel_ingestion.py` — 新增 `_split_unified_by_type`，`_resolve_all` 優先讀統一 sheet。
- `backend/app/data/feature_engineering.py` — 引入 `_column_entries` 抽取器，`compute_generic_explore` 接受 per-type dfs。
- `backend/app/routers/projects.py` — 傳遞 `node_dfs` / `edge_dfs` 給 explore；impute 會同步更新 per-type 框架。
- `backend/app/training/optuna_search.py` — 統一 HPO，支援 node / graph_homo / graph_hetero 三種 shape；回傳 `completed_trials`。
- `backend/app/training/pipeline.py` — 所有任務都走 HPO；PREPROCESSING 階段就把 `total_trials` 送回前端。
- `backend/scripts/generate_excel_demos.py` — 產出新格式 demo Excel。
- `backend/demo_data/demo_multigraph_{homo,hetero}.v2.xlsx` — 以新格式重新產出。
- `backend/tests/test_excel_ingestion.py` — 新增 3 個單一 sheet 格式測試。
- `backend/tests/test_explore_hetero.py` — 新檔；回歸測試 per-type 缺失計算。
- `backend/tests/test_demo_data.py` — 新檔；demo 檔案煙霧測試。

## 驗證

- `backend/tests/` 36 個測試 100% 通過。
