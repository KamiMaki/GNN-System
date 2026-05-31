# 2026-05-31 — TransformerConv model, repo cleanup, handover doc, full audit

## Summary

Added a **Transformer (graph-attention) GNN** to the model pool, removed dead
code/data/docs to leave a clean tree, wrote an engineering **handover document**,
and ran a full **test + lint + CVE** pass across backend and frontend.

## TransformerConv model

- New `backend/app/models/transformer.py` (`TransformerClassifier`, built on
  `torch_geometric.nn.TransformerConv`), mirroring the GAT module's structure.
- Registered in `factory.py` (`HOMO_REGISTRY` + `HETERO_BACKBONES`) and wired into
  `hetero_wrapper.py` as a `to_hetero`-liftable backbone (it is bipartite-safe and
  needs no `add_self_loops` workaround).
- Frontend `train/page.tsx` model picker now offers `transformer` for both
  homogeneous and heterogeneous datasets.
- Optuna HPO picks it up automatically (the search list is derived from the
  registry — no separate list to edit).
- New tests: `backend/tests/test_transformer_model.py` (8 tests: registry,
  node/graph single- & multi-Y shapes, classification, hetero lift).
- Details: `docs/technical/transformerconv-model.md`,
  `docs/usage/transformerconv-model.md`.

## Repository cleanup

- **Worktrees:** removed the stale `festive-tu-bafdf0` worktree and pruned two
  orphaned worktree registrations (`eager-kare`, `exciting-jang`); their on-disk
  dirs under the gitignored `.claude/worktrees/` were deleted.
- **Demo data:** deleted orphaned `backend/demo_data/demo_multigraph_homo.xlsx`
  (legacy unversioned alias) and `demo_multigraph_homo_large.v2.xlsx` (a 100-graph
  stress file never registered or tested); `generate_excel_demos.py` no longer
  references them. The 5 registered demos are unchanged.
- **Frontend boilerplate:** deleted unused create-next-app SVGs
  (`next/vercel/file/globe/window.svg`); kept `graphx-icon.svg` (in use).
- **Stale docs:** rewrote `frontend/README.md` (it described a defunct
  "AutoCircuitGNN" with MUI / DEF-LEF ingestion / mock SSO) to match the real app
  (GraphX.AI, Ant Design, Excel upload, Keycloak); removed the stale
  `frontend/README_TESTING.md` (referenced a `Sidebar.test.tsx` that no longer
  exists).
- `README.md` supported-task-types table + repo layout updated for Transformer.

## Handover document

- New `docs/HANDOVER.md`: tech stack, architecture, full `/api/v1` surface, Excel
  data contract, model layer + extension recipe, training/task lifecycle, storage
  model, integration guidance for a parent system, and a known-caveats list.

## Lint compliance

- Added an enforced ruff config to `backend/pyproject.toml`
  (`[tool.ruff]` + per-file `E402` ignore for the `pytest.importorskip` test
  pattern). Fixed genuine findings: moved `factory.py`'s logger init below imports,
  renamed an ambiguous `l` in `pipeline.py`, removed dead imports, split a
  multi-statement line in the smoke test, and annotated the intentional late import
  in `main.py`. **`ruff check app tests` → all checks pass.**
- Frontend: cleared the lone `react-hooks/set-state-in-effect` error (matched the
  file's existing inline-disable convention) and an unused test import.
  **`npm run lint` → clean.**

## Verification (this change)

| Check | Result |
|-------|--------|
| Backend `pytest -q` | **120 passed** |
| Backend `ruff check app tests` | **All checks passed** |
| Frontend `npm test` (Jest) | **13 suites / 54 tests passed** |
| Frontend `npx tsc --noEmit` | **clean (exit 0)** |
| Frontend `npm run lint` (eslint) | **clean** |

## CVE scan (snapshot — all findings are in third-party deps, none first-party)

**Backend** (`pip-audit` of installed versions): advisories concentrate in a few
outdated transitive deps —
- `torch 2.6.0` — ~17 advisories (fixes across 2.7.x–2.9.x). Upgrade requires
  re-validating the CUDA `cu124` build; treat as a planned change.
- `urllib3 1.26.13` — ~10 advisories; `requests 2.28.1` — ~5. **Low-risk, high-value
  bump** to current versions.
- `python-multipart 0.0.22`, `pygments 2.19.2`, `python-dotenv 1.2.1` — single
  advisories with fix versions; `setuptools 70.2.0` (build-time), `pytest 9.0.2`
  (dev-only).

**Frontend** (`npm audit`): 11 advisories (5 high incl. `undici`, `ws`; moderate
`uuid` via `jest-junit`). `npm audit fix` covers the non-breaking ones.

**Recommendation:** bump `urllib3`/`requests`/`python-multipart` and run
`npm audit fix` now (low risk); schedule the `torch` upgrade behind GPU
re-validation. No code changes are required for any of these. Not applied in this
change to avoid coupling a dependency upgrade with the feature work.

## Notable findings surfaced (not changed)

- `backend/.git` is a **nested git repository** while the same files are tracked by
  the root repo — an anomaly left untouched (deleting a `.git` is destructive).
  See `docs/HANDOVER.md` §10.
- `demo_multigraph_homo_no_type.xlsx` and `demo_multigraph_multi_y.xlsx` are
  registered/tested demos that `generate_excel_demos.py` does **not** regenerate
  (committed binaries only). Flagged in the handover.
