"""Unit tests for TargetScaler — pure numpy/torch, no Lightning required."""
from __future__ import annotations

import numpy as np
import pytest

torch = pytest.importorskip("torch")

from app.training.target_scaler import TargetScaler  # noqa: E402


def test_identity_scaler_is_noop():
    s = TargetScaler.identity_()
    t = torch.tensor([1.0, 2.0, 3.0])
    assert torch.equal(s.transform_tensor(t), t)
    assert torch.equal(s.inverse_tensor(t), t)
    assert np.array_equal(s.inverse_np(np.array([1.0, 2.0])), np.array([1.0, 2.0]))


def test_fit_and_roundtrip():
    y = np.array([100.0, 200.0, 300.0, 400.0, 500.0])
    s = TargetScaler.fit(y)
    assert not s.identity
    scaled = s.transform_tensor(torch.tensor(y, dtype=torch.float))
    # mean ≈ 0, std ≈ 1
    assert abs(float(scaled.mean().item())) < 1e-5
    assert abs(float(scaled.std(unbiased=False).item()) - 1.0) < 1e-5
    # inverse restores
    restored = s.inverse_tensor(scaled)
    assert torch.allclose(restored, torch.tensor(y, dtype=torch.float), atol=1e-4)


def test_constant_target_does_not_divide_by_zero():
    s = TargetScaler.fit(np.array([3.0, 3.0, 3.0]))
    # std is clamped to 1.0 when near-zero — no NaN/Inf
    t = s.transform_tensor(torch.tensor([3.0, 3.0]))
    assert torch.isfinite(t).all()


def test_dict_roundtrip():
    s = TargetScaler.fit(np.arange(10).astype(float))
    d = s.to_dict()
    s2 = TargetScaler.from_dict(d)
    assert s2.identity == s.identity
    assert abs(s2.mean - s.mean) < 1e-9
    assert abs(s2.std - s.std) < 1e-9


def test_from_dict_none_returns_identity():
    s = TargetScaler.from_dict(None)
    assert s.identity
