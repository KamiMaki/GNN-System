# 異質圖訓練 & CSV 清理 — 技術文件

## 這次改了什麼

### 新增
- `backend/app/data/pyg_converter_hetero.py` — DataFrames → list[HeteroData]
- `backend/app/models/hetero_wrapper.py` — `HeteroGraphRegressor`（to_hetero + per-type mean pool + 線性 head）
- `backend/scripts/generate_excel_demos.py` — 產生 homo + hetero 兩個 demo .xlsx
- `backend/demo_data/{demo_multigraph_homo,demo_multigraph_hetero}.xlsx`
- 文件：changelog、usage、technical

### 修改
- `backend/app/data/excel_spec.py` — `ExcelGraphSpec` 新增 `is_heterogeneous()` / `node_types()` / `edge_types()` / payload 帶出異質資訊
- `backend/app/data/excel_ingestion.py` — 解除多-Type 限制；回傳 `node_dfs` / `edge_dfs` / `canonical_edges`；支援 `Source_Node_Type` / `Target_Node_Type` 欄解析
- `backend/app/data/pyg_converter.py` — 重寫；新增 `dataframes_to_graph_list()`；移除循環式 legacy `dataframes_to_pyg`
- `backend/app/data/feature_engineering.py` — 移除 `compute_explore_stats` legacy；`compute_generic_explore` 新增 `graph_count` / `avg_nodes_per_graph` / `avg_edges_per_graph` / 異質中繼資料
- `backend/app/models/factory.py` — 加入 `metadata` kwarg；有值時回傳 `HeteroGraphRegressor`
- `backend/app/training/pipeline.py` — 三條分支：hetero list / homo graph list / node single-Data；圖級任務改用 PyG DataLoader batching
- `backend/app/routers/projects.py` — 重寫；Excel-only ingest、異質 dataset record、新增 demo excel endpoints、`graph-sample` 回傳 node_type / edge_type
- `backend/app/schemas/api_models.py` — 重寫；移除 legacy `ExploreData`
- `backend/app/core/config.py` — 移除 CSV/circuit-specific 常數
- `backend/app/main.py` — 移除 datasets router + mock-dataset lifespan
- `frontend/lib/api.ts` — 重寫；移除 legacy APIs、加異質 type
- `frontend/components/GraphPreview.tsx` — 新增 node_type palette + hetero legend
- `frontend/app/projects/[id]/upload/page.tsx` — Excel-only UI + demo cards
- `frontend/app/projects/[id]/explore/page.tsx` — Section I 改為多圖 + 異質摘要
- `frontend/app/projects/[id]/models/page.tsx` — 移除 CSV-based evaluate，保留 list/edit/delete/detail

### 移除
- `backend/app/data/mock_loader.py`、`backend/app/data/ingestion.py`
- `backend/app/routers/datasets.py`
- `backend/generate_mock_data.py`
- `backend/mock_data/`（5 demo 資料夾 + 4 root CSV）
- `backend/tests/test_api.py`、`test_ingestion.py`、`test_pyg_converter.py`
- `frontend/lib/__tests__/api.test.ts`、`api-extended.test.ts`

## 為什麼這樣做

### 選 `to_hetero` 而不是 HGT
- `torch_geometric.nn.to_hetero(homo_backbone, metadata)` 把既有 `_HomoBackbone`（GCNConv / GATConv / SAGEConv 堆疊）自動複製到每個 relation
- 免去重寫三個新模型的成本
- 足以支撐 demo 的 3 node types / 3 edge types 規模
- 未來要升級 HGT 時可直接替換 `self.hetero_gnn = to_hetero(...)` 這一行

### 為什麼完全刪掉 CSV 而不是保留雙軌
- 使用者明確要「架構最簡潔 for Excel use」
- CSV 路徑的 legacy config（如 `CELL_TYPES`、`LABEL_COLUMN`）綁死在特定領域，無法一般化
- 測試表面縮小 → 改動比較好驗

## 怎麼運作的

### 流程圖

```
用戶上傳 .xlsx
    ↓
POST /projects/{id}/upload-excel
    ↓
parse_excel_file(bytes)  ── excel_ingestion.py
    ├─ parse_parameter_sheet() → ExcelGraphSpec
    ├─ 讀 Node_{type} / Edge_{type} / Graph_{type} sheets
    ├─ normalise (Node→node_id, Source_Node_ID→src_id, Source_Node_Type→src_type…)
    └─ 推導 task_type + canonical_edges
    ↓
_store_excel_dataset() 建 dataset record：
    ├─ nodes_df / edges_df / graph_df         （unified views）
    ├─ node_dfs / edge_dfs                    （hetero 路徑）
    ├─ canonical_edges, node_types, edge_types
    └─ is_heterogeneous, declared_task_type, declared_label_column
    ↓
compute_generic_explore() 算 graph_count / avg_* / hetero 資訊
    ↓
store.put_dataset(...)
    ↓
POST /projects/{id}/train
    ↓
run_training_task(task_id)  ── pipeline.py
    ├─ is_graph_task + is_hetero → _prepare_hetero() → list[HeteroData]
    ├─ is_graph_task            → _prepare_graph_homo() → list[Data]
    └─ node task               → _prepare_node() → single Data
    ↓
get_model(model_name, ..., metadata=metadata)
    ├─ metadata 有值 → HeteroGraphRegressor(to_hetero(backbone, metadata))
    └─ 否則        → GCN/GAT/SAGE/GIN/MLP
    ↓
torch_geometric.loader.DataLoader（batch_size=min(8, len)）
    ↓
PyTorch Lightning Trainer → fit → metrics → checkpoint
```

### to_hetero metadata 組成

```python
metadata = (
    node_types,        # e.g. ['cell', 'pin', 'net']
    canonical_edges,   # e.g. [('cell','cell2pin','pin'), ('pin','pin2pin','pin'), ('pin','pin2net','net')]
)
```

`to_hetero(homo_module, metadata)` 會把 `homo_module` 裡的每個 `conv(x, edge_index)` 轉成
`conv[rel](x[src_type], edge_index[src_type, rel, dst_type])`，結果以 `aggr='mean'` 合成回各 type 的 embedding。

### HeteroGraphRegressor forward

```
x_dict, edge_index_dict, batch_dict
    ↓ to_hetero-wrapped GNN
h_dict     （每個 node_type 的節點 embedding）
    ↓ for each node_type: global_mean_pool(h[nt], batch[nt])
pooled list
    ↓ concat
[batch_size, hidden * |node_types|]
    ↓ Linear head
[batch_size, num_classes]   （regression 時 num_classes=1，回傳 squeeze(-1)）
```

### 欄位 normalisation 對照

| Template 欄位             | 後端慣例    |
|---------------------------|-------------|
| `Node`                    | `node_id`   |
| `Graph_ID`                | `_graph`    |
| `Source_Node_ID`          | `src_id`    |
| `Target_Node_ID`          | `dst_id`    |
| `Source_Node_Type`        | `src_type`  |
| `Target_Node_Type`        | `dst_type`  |
| 加入於 ingestion          | `_node_type`、`_edge_type` |

## 注意事項

### 已知限制
- `to_hetero` 對 edge_attr 的支援有限；hetero backbone 目前 **不把 edge_attr 傳入 conv**，所以 hetero demo 的 edge X 欄位用於統計展示但不進入 hetero 模型
- `global_mean_pool` 需要 `batch_dict`（每個 node_type 各一份）；empty type in a given batch 會被填 zeros（已處理）
- Hetero 路徑不跑 Optuna HPO — 用固定 `hidden_dim=64, num_layers=3, dropout=0.2, lr=1e-3`；後續可以再加 HPO
- Node type > 10 時 palette 會循環；使用者若需要更多可擴充 `HETERO_PALETTE` 陣列

### Phase 3 路線
| 能力                           | 需修改的檔                                        |
|--------------------------------|----------------------------------------------------|
| Edge-level prediction          | `pipeline.py`、`models/factory.py`（新 edge head） |
| Multi-task weighted loss       | `pipeline.py`、`hetero_wrapper.py`                 |
| HGT                            | `hetero_wrapper.py` (替換 `to_hetero` 實作)        |
| Excel-based model evaluation UI| `frontend/app/projects/[id]/models/page.tsx`       |

### 測試執行
```bash
cd backend && pytest tests/ -q
cd frontend && npx jest --silent
cd frontend && npx tsc --noEmit
cd backend && python scripts/generate_excel_demos.py   # 重新產生 demo
```
