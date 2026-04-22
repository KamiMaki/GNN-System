# 異質圖 Excel Template 使用指南

## 什麼是異質圖

異質圖（Heterogeneous Graph）的節點或邊有**多種類型**，各類型間有不同的特徵與關係。例如 IC layout 場景：

```
cell  ——(cell2pin)——→  pin  ——(pin2pin)——→ pin  ——(pin2net)——→ net
```

- 3 種節點：`cell`、`pin`、`net`
- 3 種邊：`cell2pin`、`pin2pin`、`pin2net`

平台會用 PyG 的 `HeteroData` 容納這種結構，並透過 `to_hetero()` 訓練對應的 GNN 模型。

## 如何在 Excel template 宣告異質圖

### Parameter sheet — 用不同 `Type` 代表不同類型

| XY | Level | Type      | Parameter   | Weight |
|----|-------|-----------|-------------|--------|
| X  | Node  | cell      | cell_area   |        |
| X  | Node  | cell      | cell_drive  |        |
| X  | Node  | pin       | pin_cap     |        |
| X  | Node  | pin       | pin_slew    |        |
| X  | Node  | net       | net_fanout  |        |
| X  | Edge  | cell2pin  | c2p_delay   |        |
| X  | Edge  | pin2pin   | p2p_wire_len|        |
| X  | Edge  | pin2net   | p2n_res     |        |
| X  | Graph | default   | num_cells   |        |
| Y  | Graph | default   | total_wirelength | 1.0 |

重點：
- 同一 `Level` 下的 **不同 Type 就是不同節點 / 邊類型**
- Y 仍然放在 Graph level（目前只支援 graph regression / classification）

### 資料 sheet — 每個 type 一張

- `Node_cell`：cell 節點的 Graph_ID / Node / 特徵欄
- `Node_pin`：pin 節點
- `Node_net`：net 節點
- `Edge_cell2pin`、`Edge_pin2pin`、`Edge_pin2net`
- `Graph_default`：Graph_ID 與 graph-level 特徵 + Y 欄

### Edge sheet 必須多兩欄

為了讓後端判斷 (src_type, relation, dst_type)，異質 Edge sheet 要宣告：

| Graph_ID | Source_Node_ID | Target_Node_ID | Source_Node_Type | Target_Node_Type | Edge_Type | c2p_delay |
|----------|----------------|----------------|-------------------|-------------------|-----------|-----------|
| 1        | 0              | 0              | cell              | pin               | cell2pin  | 12.3      |

（同質圖不需要這兩欄，舊格式向下相容）

## 一鍵載入內建 demo

平台附了兩個現成的 demo Excel，可直接試：

1. Upload 頁 → 「Demo Excel Datasets」卡片
2. 點 **Multi-Graph Heterogeneous** 的 Load → 自動上傳 10 張異質圖（cell/pin/net），target = total_wirelength
3. 跳到 Explore 頁會看到：
   - `Graphs: 10 · Avg Nodes: ~52.8 · Avg Edges: ~105.1`
   - Heterogeneous badge
   - Node types: `cell` / `pin` / `net`
   - Edge types: `cell → cell2pin → pin` / `pin → pin2pin → pin` / `pin → pin2net → net`
4. GraphPreview 每個節點會依 type 上不同顏色，下拉可切換 graph_1 ~ graph_10

## 訓練異質圖

上傳後直接進 Train 頁 → 點 Train。後端流程：

1. `parse_excel_file()` 辨識為異質圖 → 產生 `node_dfs` / `edge_dfs`
2. `parsed_excel_to_hetero_list()` 為每張圖建一個 `HeteroData`
3. `HeteroGraphRegressor` 用 `to_hetero(backbone, metadata)` 把 backbone 升級成異質版
4. 訓練完成後在 Report 頁看 MSE / MAE / R²

## 目前限制（未支援）

| 功能                                 | 原因 / 替代 |
|--------------------------------------|-------------|
| Node-level prediction on hetero      | 需 per-type head，Phase 3 |
| Edge-level prediction                | 需 edge 分類頭 |
| Multi-task weighted loss (消費 Weight) | loss combine 尚未實作 |
| HGT / Attention-aware hetero         | 目前 to_hetero 是 relation-agnostic |
| 節點 type 超過 10 種的配色           | palette 目前只有 10 色循環 |

如遇到上述限制會在上傳或訓練時回傳明確錯誤訊息。
