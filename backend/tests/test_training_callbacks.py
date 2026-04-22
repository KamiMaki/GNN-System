"""Unit tests for ProgressCallback / TrialProgressCallback progress math.

These tests exercise the pure-Python phase-progress logic without booting a
full Lightning Trainer, so they run in CI as soon as torch is available.
"""
from __future__ import annotations

import pytest

torch = pytest.importorskip("torch")
pl = pytest.importorskip("pytorch_lightning")

from app.training.callbacks import ProgressCallback, TrialProgressCallback  # noqa: E402


def test_progress_callback_monotonic_within_phase():
    cb = ProgressCallback(
        task_id="t", max_epochs=10, phase_range=(50, 99),
        task_type="graph_regression",
    )
    progress_values = [cb._phase_progress(i + 1) for i in range(10)]
    # monotonic non-decreasing
    for a, b in zip(progress_values, progress_values[1:]):
        assert b >= a, f"progress regressed {a} -> {b}"
    # bounded to phase window
    for v in progress_values:
        assert 50 <= v <= 99
    # first epoch should step up beyond the start
    assert progress_values[0] > 50
    # final value reaches the phase cap
    assert progress_values[-1] == 99


def test_progress_callback_early_stop_does_not_exceed_cap():
    # When early-stop cuts training at epoch 7/10, we should still never
    # exceed the phase ceiling; progress for epoch 7 < ceiling.
    cb = ProgressCallback(
        task_id="t", max_epochs=50, phase_range=(50, 99),
        task_type="graph_regression",
    )
    mid = cb._phase_progress(7)
    assert mid < 99


def test_trial_progress_callback_monotonic(monkeypatch):
    calls = []

    def fake_update(task_id, **kw):
        calls.append((task_id, kw))

    from app.core import store as store_mod
    monkeypatch.setattr(store_mod, "update_task", fake_update)

    class _Trial:
        def __init__(self, n): self.number = n

    cb = TrialProgressCallback("t", n_trials=5, phase_range=(15, 50))
    for i in range(5):
        cb(None, _Trial(i))

    progress = [c[1]["progress"] for c in calls]
    # monotonic + bounded
    for a, b in zip(progress, progress[1:]):
        assert b >= a
    assert all(15 <= p <= 50 for p in progress)
    assert progress[-1] == 50
