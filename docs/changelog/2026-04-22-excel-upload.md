# 2026-04-22 — Excel Template Upload (Phase 1)

## Added
- **Backend**
  - `backend/app/data/excel_spec.py` — `ExcelGraphSpec` dataclass + `parse_parameter_sheet()`.
  - `backend/app/data/excel_ingestion.py` — `parse_excel_file()` reads a 4-sheet template and returns normalised DataFrames + declared task type / label column.
  - `POST /api/v1/projects/{id}/upload-excel` — schema-driven dataset upload.
  - `GET /api/v1/projects/sample-excel` — download bundled `graph_data_template.xlsx`.
  - Tests: `backend/tests/test_excel_ingestion.py` (16 cases), `backend/tests/test_excel_router.py` (4 cases).
  - Added `openpyxl>=3.1.0` to `backend/pyproject.toml`.
- **Frontend**
  - `uploadProjectExcel()` + `downloadSampleExcel()` in `frontend/lib/api.ts`.
  - `DatasetSummary` interface extended with `declared_task_type`, `declared_label_column`, `schema_spec`.
  - New "Upload Excel Template" card at the top of `frontend/app/projects/[id]/upload/page.tsx` (CSV folder upload preserved as "legacy").
  - Tests: `frontend/lib/__tests__/api-excel.test.ts`.

## Changed
- `DatasetSummary` (pydantic) gains three optional fields for Excel-origin datasets.
- When Excel is uploaded, the project advances straight to step 3 (`data_confirmed`) because task type and label column are declared in the Parameter sheet.

## Not Changed (Phase 1 scope boundary)
- `pyg_converter.py`, `training/pipeline.py`, `models/factory.py` untouched — Excel DataFrames feed the existing dynamic converter.
- Existing CSV upload endpoints (`/upload`, `/upload-folder`) and demo datasets unchanged.

## Deferred to Phase 2
- Edge-level prediction (requires new model head).
- Multi-task weighted loss (consuming the Parameter `Weight` column).
- Heterogeneous graphs via multiple Types per Level (requires `HeteroData`).

## Migration Impact
None. This is purely additive. Existing pytest + Jest suites are unmodified and must remain green.
