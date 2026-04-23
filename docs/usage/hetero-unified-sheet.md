# 使用指南：異質圖統一 Excel 格式

*2026-04-24 起生效*

## 新舊格式比較

### 舊格式（仍可用，不再建議）

每個節點型別、每個邊型別各自一個 sheet：

```
Parameter
Node_cell
Node_pin
Node_net
Edge_cell2pin
Edge_pin2pin
Edge_pin2net
Graph_default
```

### 新格式（推薦）

單一 `Node` / `Edge` sheet，用 `Type` 欄區分子型別：

```
Parameter
Node       ← 含所有節點，Type 欄標示 cell/pin/net
Edge       ← 含所有邊，Type 欄標示 cell2pin/pin2pin/pin2net
Graph      ← 圖層級特徵與 Y
```

## Node sheet 範例

| Graph_ID | Node | Type | cell_area | cell_drive | pin_cap | pin_slew | net_fanout |
|----------|------|------|-----------|------------|---------|----------|------------|
| 1        | 0    | cell | 1.25      | 4          |         |          |            |
| 1        | 1    | cell | 2.10      | 2          |         |          |            |
| 1        | 0    | pin  |           |            | 0.42    | 35.7     |            |
| 1        | 1    | pin  |           |            | 0.18    | 22.1     |            |
| 1        | 0    | net  |           |            |         |          | 5          |

**規則**：
- 每列一個節點；不屬於該型別的 feature **直接留空**。
- `Node` 欄是該型別內的 ID（可從 0 開始重新編號）。
- `Graph_ID` 支援多圖批次。

## Edge sheet 範例

| Graph_ID | Source_Node_ID | Target_Node_ID | Source_Node_Type | Target_Node_Type | Type      | c2p_delay | p2p_wire_len | p2n_res |
|----------|----------------|----------------|------------------|------------------|-----------|-----------|--------------|---------|
| 1        | 0              | 0              | cell             | pin              | cell2pin  | 12.3      |              |         |
| 1        | 0              | 1              | pin              | pin              | pin2pin   |           | 8.5          |         |
| 1        | 0              | 0              | pin              | net              | pin2net   |           |              | 0.72    |

## Parameter sheet（兩種格式共用）

Parameter sheet 的結構沒變，每一列描述一個 feature / label：

| XY | Level | Type      | Parameter        | Weight |
|----|-------|-----------|------------------|--------|
| X  | Node  | cell      | cell_area        |        |
| X  | Node  | cell      | cell_drive       |        |
| X  | Node  | pin       | pin_cap          |        |
| X  | Node  | pin       | pin_slew         |        |
| X  | Node  | net       | net_fanout       |        |
| X  | Edge  | cell2pin  | c2p_delay        |        |
| X  | Edge  | pin2pin   | p2p_wire_len     |        |
| X  | Edge  | pin2net   | p2n_res          |        |
| X  | Graph | default   | num_cells        |        |
| Y  | Graph | default   | total_wirelength | 1.0    |

Parameter 仍然是「feature 的型別歸屬」的唯一來源；後端會根據這張表決定哪些欄位屬於哪個型別。

## 下載示範檔

- 首頁 → 「載入示範資料」→ `Multi-Graph Heterogeneous`
- 或直接下載 `backend/demo_data/demo_multigraph_hetero.v2.xlsx`

## 若 Explore 仍顯示大量缺失？

這是舊版 bug，已於 2026-04-24 修正。請升級到最新後端即可。

## Training Trials

- 所有任務類型（node / graph、homogeneous / heterogeneous）現在都會真正跑 Optuna HPO。
- 預設 Trials 數 = 150；可在 Training 頁面的 slider 調整 10 ~ 300。
- 訓練中 UI 會顯示 `Trial X / N`，隨每個 trial 完成而更新。
