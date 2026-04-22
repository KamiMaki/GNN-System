# 2026-04-24 — Training Quality (Phase 3)

## Added
- **TargetScaler** (`backend/app/training/target_scaler.py`) — regression target
  standardization. Fits a StandardScaler on train-split `y`, applies to train
  + val during fit, and inverse-scales predictions for metric reporting.
  Prevents the "R² = -99" pathology seen on hetero demo before.
- **Phase-aware `ProgressCallback`** — takes `phase_range=(start, end)`; progress
  maps monotonically inside the phase window; `history[*].lr` captured.
- **`TrialProgressCallback`** — replaces ad-hoc Optuna progress lambda; also
  monotonic within its HPO phase window.
- **Explicit Lightning Trainer config** on every branch:
  - `accelerator="gpu"` + `devices=1` + `precision="16-mixed"` on CUDA hosts
  - `gradient_clip_val=1.0`
  - `ModelCheckpoint(monitor="val_loss", save_top_k=1)`; best weights reloaded
    before evaluation + registry serialization
  - `EarlyStopping(monitor="val_loss", patience=10)`
- **Optuna HPO early stop** — each objective Trainer now has
  `EarlyStopping(patience=3)` + reduced `max_epochs=15`.
- **LR Scheduler** — every homogeneous model + the `HeteroGraphRegressor`
  returns `ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3)` from
  `configure_optimizers()`.
- **Deterministic seed** — `pl.seed_everything(42, workers=True)` at the start
  of every training task.
- **3-way split** — 60/20/20 for graph-level datasets ≥ 5 graphs; falls back
  to 80/20 + val=test for smaller datasets with a warning.
- **Demo data expanded** — both `demo_multigraph_homo.xlsx` and
  `demo_multigraph_hetero.xlsx` now contain **30 graphs** (was 10) so the
  test split has enough samples for R² to be statistically meaningful.

## Changed
- `EpochHistory.lr` added (Optional[float]).
- `DatasetSummary`/`GenericExploreData` unchanged.
- Checkpoint format gains `target_scaler: dict` field; older checkpoints
  load fine — `TargetScaler.from_dict(None)` returns an identity scaler.

## Verified
- **E2E hetero demo (30 graphs)**: monotonic progress, train R² = 0.28,
  test R² = -0.39 (> -1 acceptance bar), 33/50 epochs via early stop, LR
  decayed 0.001 → 3.125e-05 across 5 plateau reductions.
- **E2E homo demo (30 graphs)**: train R² = 0.93, test R² = -0.18, 32 epochs.
- **pytest**: 25 / 25 pass (17 ingestion + 3 callbacks + 5 target scaler).

## Still deferred (Phase 4)
- TensorBoard / W&B integration (external logger).
- LR Finder (`pl.tuner.Tuner`).
- Data augmentation (edge dropout / node masking).
- Multi-GPU (DDP).
- Graph-level HPO (hetero currently uses fixed config).
