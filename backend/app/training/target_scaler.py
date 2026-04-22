"""Regression target standardization.

Hetero demo labels (e.g. `total_wirelength` ~600) explode MSE and produce
uninterpretable R². Fit a StandardScaler on train-split `y`, apply to train /
val / test during fit; un-scale predictions for metric reporting so metrics
stay in the original target space.

For classification tasks an identity scaler is used — `transform` / `inverse`
are no-ops.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import torch


@dataclass
class TargetScaler:
    """Minimal StandardScaler for a 1-D target tensor.

    When ``identity=True`` (the default for classification) all operations are
    no-ops — lets the pipeline treat both task kinds with a single code path.
    """
    identity: bool = True
    mean: float = 0.0
    std: float = 1.0

    @classmethod
    def identity_(cls) -> "TargetScaler":
        return cls(identity=True, mean=0.0, std=1.0)

    @classmethod
    def fit(cls, values: np.ndarray | list[float]) -> "TargetScaler":
        arr = np.asarray(values, dtype=np.float64)
        if arr.size == 0:
            return cls.identity_()
        mean = float(arr.mean())
        std = float(arr.std())
        if std < 1e-8:
            std = 1.0
        return cls(identity=False, mean=mean, std=std)

    # ── tensor ops ──

    def transform_tensor(self, t: torch.Tensor) -> torch.Tensor:
        if self.identity:
            return t
        return (t - self.mean) / self.std

    def inverse_tensor(self, t: torch.Tensor) -> torch.Tensor:
        if self.identity:
            return t
        return t * self.std + self.mean

    # ── numpy ops (for post-evaluation metrics) ──

    def inverse_np(self, a: np.ndarray) -> np.ndarray:
        if self.identity:
            return a
        return a * self.std + self.mean

    # ── serialisation (for checkpoint persistence) ──

    def to_dict(self) -> dict:
        return {"identity": self.identity, "mean": self.mean, "std": self.std}

    @classmethod
    def from_dict(cls, d: Optional[dict]) -> "TargetScaler":
        if not d:
            return cls.identity_()
        return cls(identity=bool(d.get("identity", True)),
                   mean=float(d.get("mean", 0.0)),
                   std=float(d.get("std", 1.0)))
