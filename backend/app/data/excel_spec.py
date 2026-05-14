"""Excel template schema (Parameter sheet) parsing.

The graph_data_template.xlsx Parameter sheet declares every feature / label with:
    XY        : "X" (feature) or "Y" (label / prediction target)
    Level     : "Node" | "Edge" | "Graph"
    Parameter : column name inside the corresponding data sheet (e.g. "X_1").
    Type      : (optional) subtype suffix — combined with Level forms the data
                sheet name in the legacy layout (e.g. "Node_cell"). When the
                Type column is OMITTED from the Parameter sheet, Types are
                discovered from the data sheets themselves (the Type column on
                the Node/Edge/Graph sheets) and each parameter is auto-assigned
                to whichever Types actually carry data for that column.
    Weight    : loss weight — only meaningful for Y rows; empty ⇒ 1.0.

Phase 2 scope:
    * Heterogeneous graphs supported (multiple Types per Level).
    * Single Y level (Node OR Graph). Edge-level prediction + multi-task
      remain deferred to a later phase.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

import pandas as pd


VALID_LEVELS = ("Node", "Edge", "Graph")
VALID_XY = ("X", "Y")

REQUIRED_PARAMETER_COLUMNS = ["XY", "Level", "Parameter"]
OPTIONAL_PARAMETER_COLUMNS = ["Type", "Weight"]


@dataclass
class ParameterEntry:
    """One row from the Parameter sheet."""
    xy: Literal["X", "Y"]
    level: Literal["Node", "Edge", "Graph"]
    parameter: str             # column name inside the corresponding data sheet
    # Loss weight. For Y rows: blank cell ⇒ 1.0 (default), explicit number used as-is.
    # For X rows: stays None (weight is meaningless for features).
    weight: Optional[float] = None
    # Type sheet suffix. Set when the Parameter sheet had a Type column, or
    # filled in by ``ExcelGraphSpec.assign_types_for_level`` once the data
    # sheets have been inspected. May remain None for X features that apply to
    # multiple Types — use ``ExcelGraphSpec.types_for_parameter`` to recover
    # the full list.
    type_: Optional[str] = None


@dataclass
class ExcelGraphSpec:
    """Structured view of the Parameter sheet."""
    entries: list[ParameterEntry] = field(default_factory=list)
    # Resolved Type lists per Level. Populated either from the Parameter
    # sheet's Type column (when present) or from the data sheets later.
    _types_by_level: dict[str, list[str]] = field(default_factory=dict)
    # (level, parameter) → list of Types that carry that parameter.
    _param_types: dict[tuple[str, str], list[str]] = field(default_factory=dict)
    # True when the Parameter sheet itself declared the Type column; False
    # means callers must invoke ``assign_types_for_level`` after reading the
    # data sheets.
    types_declared_in_parameter_sheet: bool = False

    # ── basic introspection ──

    def types_for_level(self, level: str) -> list[str]:
        """Distinct Type values declared for a given Level."""
        return list(self._types_by_level.get(level, []))

    def entries_for_level(self, level: str) -> list[ParameterEntry]:
        return [e for e in self.entries if e.level == level]

    def entries_for(self, level: str, type_: str) -> list[ParameterEntry]:
        return [
            e for e in self.entries
            if e.level == level
            and type_ in self._param_types.get((level, e.parameter), [])
        ]

    def types_for_parameter(self, level: str, parameter: str) -> list[str]:
        return list(self._param_types.get((level, parameter), []))

    def x_columns(self, level: str, type_: str) -> list[str]:
        return [e.parameter for e in self.entries_for(level, type_) if e.xy == "X"]

    def y_columns(self, level: str, type_: str) -> list[str]:
        return [e.parameter for e in self.entries_for(level, type_) if e.xy == "Y"]

    def y_levels(self) -> list[str]:
        """Levels that have at least one Y entry, in VALID_LEVELS order."""
        have = {e.level for e in self.entries if e.xy == "Y"}
        return [lv for lv in VALID_LEVELS if lv in have]

    # ── heterogeneity ──

    def node_types(self) -> list[str]:
        return self.types_for_level("Node")

    def edge_types(self) -> list[str]:
        return self.types_for_level("Edge")

    def is_heterogeneous(self) -> bool:
        """True when any Level declares more than one Type."""
        return len(self.node_types()) > 1 or len(self.edge_types()) > 1

    # ── type assignment from data sheets ──

    def assign_types_for_level(
        self,
        level: str,
        types: list[str],
        param_to_types: dict[str, list[str]],
    ) -> None:
        """Record which Types exist on ``level`` and which Types each Parameter
        applies to. Called by the ingestion pipeline after inspecting the data
        sheets when the Parameter sheet omitted the Type column.
        """
        self._types_by_level[level] = list(types)
        for param, ts in param_to_types.items():
            self._param_types[(level, param)] = list(ts)
        # Backfill ``type_`` on entries with a single resolved Type so legacy
        # consumers reading ``e.type_`` keep working for the common case.
        for e in self.entries:
            if e.level != level:
                continue
            resolved = self._param_types.get((level, e.parameter), [])
            if len(resolved) == 1 and e.type_ is None:
                e.type_ = resolved[0]

    # ── serialisation ──

    def to_payload(self) -> dict:
        """JSON-serializable representation for persistence / API responses."""
        out_entries = []
        for e in self.entries:
            types = self.types_for_parameter(e.level, e.parameter)
            # Legacy ``type`` field: first matched, or whatever the entry was
            # parsed with.
            legacy_type = e.type_ if e.type_ is not None else (types[0] if types else None)
            out_entries.append({
                "xy": e.xy,
                "level": e.level,
                "type": legacy_type,
                "types": types,
                "parameter": e.parameter,
                "weight": e.weight,
            })
        return {
            "entries": out_entries,
            "is_heterogeneous": self.is_heterogeneous(),
            "node_types": self.node_types(),
            "edge_types": self.edge_types(),
        }


def parse_parameter_sheet(df: pd.DataFrame) -> ExcelGraphSpec:
    """Validate and parse the Parameter sheet DataFrame into an ExcelGraphSpec.

    The ``Type`` column is optional. When omitted, the returned spec carries
    no Type information and must be completed via
    ``ExcelGraphSpec.assign_types_for_level`` once the data sheets are
    available (the ingestion pipeline handles this automatically).
    """
    if df is None or df.empty:
        raise ValueError("Parameter sheet is empty.")

    col_lookup = {str(c).strip(): c for c in df.columns}
    canonical = {k.lower(): v for k, v in col_lookup.items()}
    missing = [c for c in REQUIRED_PARAMETER_COLUMNS if c.lower() not in canonical]
    if missing:
        raise ValueError(
            f"Parameter sheet missing required columns: {missing}. "
            f"Expected columns: {REQUIRED_PARAMETER_COLUMNS} "
            f"(+ optional {OPTIONAL_PARAMETER_COLUMNS})."
        )

    def _get(row, key: str):
        return row[canonical[key.lower()]]

    has_type = "type" in canonical
    has_weight = "weight" in canonical

    entries: list[ParameterEntry] = []
    # When the Type column is present we record Type lists / param→Types
    # directly so callers don't need to re-derive them from data sheets.
    types_by_level: dict[str, list[str]] = {}
    param_types: dict[tuple[str, str], list[str]] = {}

    for idx, row in df.iterrows():
        xy_raw = _get(row, "XY")
        level_raw = _get(row, "Level")
        param_raw = _get(row, "Parameter")
        type_raw = _get(row, "Type") if has_type else None

        if all(
            pd.isna(v) or str(v).strip() == ""
            for v in (xy_raw, level_raw, param_raw, type_raw)
        ):
            continue

        xy = str(xy_raw).strip().upper() if not pd.isna(xy_raw) else ""
        level = str(level_raw).strip().capitalize() if not pd.isna(level_raw) else ""
        parameter = str(param_raw).strip() if not pd.isna(param_raw) else ""
        type_: Optional[str] = None
        if has_type and not pd.isna(type_raw) and str(type_raw).strip() != "":
            type_ = str(type_raw).strip()

        if xy not in VALID_XY:
            raise ValueError(
                f"Parameter sheet row {idx + 2}: XY must be 'X' or 'Y', got {xy_raw!r}."
            )
        if level not in VALID_LEVELS:
            raise ValueError(
                f"Parameter sheet row {idx + 2}: Level must be one of {VALID_LEVELS}, "
                f"got {level_raw!r}."
            )
        if not parameter:
            raise ValueError(f"Parameter sheet row {idx + 2}: Parameter name is required.")
        if has_type and type_ is None:
            raise ValueError(
                f"Parameter sheet row {idx + 2}: Type cell is blank. Either fill it "
                f"in or remove the Type column entirely to enable auto-inference "
                f"from the data sheets."
            )

        weight: Optional[float] = None
        if xy == "Y":
            # Default weight for Y rows is 1.0 — applied whether the Weight
            # column is absent entirely or the cell is blank.
            weight = 1.0
            if has_weight:
                w_raw = _get(row, "Weight")
                if not pd.isna(w_raw) and str(w_raw).strip() != "":
                    try:
                        weight = float(w_raw)
                    except (TypeError, ValueError):
                        raise ValueError(
                            f"Parameter sheet row {idx + 2}: Weight must be numeric, got {w_raw!r}."
                        )

        entries.append(ParameterEntry(
            xy=xy, level=level, parameter=parameter, weight=weight, type_=type_,
        ))

        if type_ is not None:
            level_types = types_by_level.setdefault(level, [])
            if type_ not in level_types:
                level_types.append(type_)
            pt = param_types.setdefault((level, parameter), [])
            if type_ not in pt:
                pt.append(type_)

    if not entries:
        raise ValueError("Parameter sheet has no valid rows.")

    return ExcelGraphSpec(
        entries=entries,
        _types_by_level=types_by_level,
        _param_types=param_types,
        types_declared_in_parameter_sheet=has_type,
    )
