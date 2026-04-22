# 訓練 Pipeline — 技術文件 (Phase 3)

## 核心改動總覽

| 檔案 | 改動 |
|---|---|
| `backend/app/core/config.py` | 新增 `MAX_HPO_EPOCHS`、`PRECISION`、`GRADIENT_CLIP`、`DETERMINISTIC_SEED`、`HPO_PATIENCE`、`LR_SCHED_PATIENCE` |
| `backend/app/training/target_scaler.py` | **新檔** — 回歸目標標準化 (StandardScaler) |
| `backend/app/training/callbacks.py` | 重寫；phase-aware `ProgressCallback` + `TrialProgressCallback`，progress 單調遞增、寫入 `lr` |
| `backend/app/training/optuna_search.py` | 每個 trial 加 `EarlyStopping(patience=3)`；forward `accelerator` / `precision` 到 trial Trainer |
| `backend/app/training/pipeline.py` | `pl.seed_everything(42)`；顯式 `accelerator` / `devices` / `precision` / `gradient_clip_val`；`ModelCheckpoint` 存 best；3-way split；regression target 標準化 |
| `backend/app/models/*.py` | 所有 6 個模型 `configure_optimizers` 回 `ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3)` |
| `backend/app/schemas/api_models.py` | `EpochHistory.lr` 欄 |
| `frontend/lib/api.ts` | `history[*].lr?: number` 型別同步 |
| `backend/scripts/generate_excel_demos.py` | Demo 10 → 30 graphs |

## Lightning 配置表

| 區段 | 值 |
|---|---|
| accelerator | `"gpu"` 若 CUDA 可用，否則 `"cpu"` |
| devices | 1 |
| precision | `"16-mixed"` on CUDA；`"32-true"` on CPU |
| gradient_clip_val | 1.0 |
| max_epochs | 50（settings.MAX_EPOCHS） |
| HPO max_epochs | 15（settings.MAX_HPO_EPOCHS） |
| early stopping | `EarlyStopping(monitor="val_loss", patience=10)`；HPO trial 用 `patience=3` |
| LR scheduler | `ReduceLROnPlateau(factor=0.5, patience=3, mode="min")` |
| checkpoint | `ModelCheckpoint(monitor="val_loss", mode="min", save_top_k=1, save_weights_only=True)` |
| seed | 42 (`pl.seed_everything(42, workers=True)`) |

## TargetScaler

### 為何需要
Hetero demo 的 `total_wirelength` 目標值範圍 300–1200，未經標準化時：
- MSE 直接達 ~10^5
- fp16 mixed precision 在 MSE 計算時易溢出
- R² 在小 test set 上常落到 -30 以下，訓練訊號被噪音淹沒

### 運作
```python
scaler = TargetScaler.fit(train_y)     # fit 只用 train split
for d in train + val:                   # 只 scale train 與 val
    d.y = scaler.transform_tensor(d.y)  # test set 保持原空間

# 訓練：out, batch.y 都在 scaled 空間，MSE O(1)
# 推論：scaler.inverse_np(out_np) 還原到原空間再算 metric
```

Identity scaler 用於分類任務（`transform` / `inverse` 皆為 no-op）。
Checkpoint 以 `to_dict()` / `from_dict()` 序列化，舊 checkpoint 缺此欄時 fallback 為 identity。

## 3-way Split

- **≥ 5 graphs**：60% train / 20% val / 20% test（random, seeded）
- **< 5 graphs**：80/20 split，val = test（log warning）

Early stopping 與 best checkpoint 都以 val_loss 為依據，避免 val/test 混用造成的 selection bias。

## ProgressCallback — Phase-Aware

### 問題（Phase 2 前）
- 進度只在 validation 結束時更新，且映射到 50–99 區段
- Hetero 路徑跳過 HPO → 使用者看到 15% 卡住，突然跳到 88%，像是卡死
- 沒有 lr 資訊

### Phase 3 設計
```
PREPROCESSING [0-5%]
       ↓
(可選 HPO phase) [15-50%]   — TrialProgressCallback
       ↓
TRAINING     [50-99%]       — ProgressCallback(phase_range=(50, 99))
       ↓
COMPLETED    [100%]
```

`ProgressCallback._phase_progress(epoch)` 保證：
1. 單調非遞減（前一次值被記住）
2. 不超出 phase ceiling
3. effective_max_epochs 考慮 early stop 上限（`min(MAX_EPOCHS, PATIENCE*4+5)`）

## LR Scheduler

所有模型的 `configure_optimizers` 回：
```python
{
  "optimizer": Adam(lr=lr, weight_decay=1e-4),
  "lr_scheduler": {
    "scheduler": ReduceLROnPlateau(mode="min", factor=0.5, patience=3),
    "monitor": "val_loss",
    "interval": "epoch",
  },
}
```

E2E 觀察：hetero demo 在 33 epochs 內從 lr=1e-3 降到 3.125e-5（5 次平台期 halve）。

## 驗證

```bash
cd backend && PYTHONPATH=$(pwd) .venv/Scripts/python.exe -m pytest tests/ -q
# 25 passed in 8.92s
```

E2E via API：
```bash
# Hetero
curl -X POST localhost:8000/api/v1/projects/.../load-demo-excel?demo_id=multigraph_hetero
curl -X POST localhost:8000/api/v1/projects/.../train -d '{"models":[],"n_trials":1}'
# Train R² 0.28, Test R² -0.39, 33 epochs, progress monotonic ✓

# Homo
curl -X POST localhost:8000/api/v1/projects/.../load-demo-excel?demo_id=multigraph_homo
# Train R² 0.93, Test R² -0.18, 32 epochs
```

## 注意事項 / Phase 4

1. **Hetero 仍跑 fixed config**（no HPO）—  `to_hetero` 的 backbone 組合搜尋需額外設計。
2. **fp16 mixed precision** 在某些非 Ampere GPU 可能更慢 — 未來加自動偵測。
3. **Test R² 仍可能負值** — 30 graphs 的 test split 只有 6 個樣本，變異度大；增加 demo 大小 / 換更真實資料集可緩解。
4. **ModelCheckpoint 寫入 `storage/checkpoints/{task_id}/`** — 訓練完成後 best weights 已複製到 `storage/models/{task_id}.pt`；checkpoint 目錄目前不自動清理。
