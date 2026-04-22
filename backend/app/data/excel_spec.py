"""Excel template schema (Parameter sheet) parsing.

The graph_data_template.xlsx Parameter sheet declares every feature / label with:
    XY        : "X" (feature) or "Y" (label / prediction target)
    Level     : "Node" | "Edge" | "Graph"
    Type      : subtype suffix — combined with Level forms the data sheet name,
                e.g. Level=Node + Type=default  -> sheet "Node_default".
                Supports heterogeneous graphs via multiple Types per Level.
    Parameter : column name inside the corresponding data sheet (e.g. "X_1").
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

REQUIRED_PARAMETER_COLUMNS = ["XY", "Level", "Type", "Parameter"]


@dataclass
class ParameterEntry:
    """One row from the Parameter sheet."""
    xy: Literal["X", "Y"]
    level: Literal["Node", "Edge", "Graph"]
    type_: str                 # Type sheet suffix (e.g. "default", "cell", "pin")
    parameter: str             # column name inside the corresponding data sheet
    weight: Optional[float] = None   # loss weight (Y only); None ⇒ default 1.0


@dataclass
class ExcelGraphSpec:
    """Structured view of the Parameter sheet."""
    entries: list[ParameterEntry] = field(default_factory=list)

    # ── basic introspection ──

    def types_for_level(self, level: str) -> list[str]:
        """Distinct Type values declared for a given Level (preserves first-seen order)."""
        seen: list[str] = []
        for e in self.entries:
            if e.level == level and e.type_ not in seen:
                seen.append(e.type_)
        return seen

    def entries_for(self, level: str, type_: str) -> list[ParameterEntry]:
        return [e for e in self.entries if e.level == level and e.type_ == type_]

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

    # ── serialisation ──

    def to_payload(self) -> dict:
        """JSON-serializable representation for persistence / API responses."""
        return {
            "entries": [
                {
                    "xy": e.xy,
                    "level": e.level,
                    "type": e.type_,
                    "parameter": e.parameter,
                    "weight": e.weight,
                }
                for e in self.entries
            ],
            "is_heterogeneous": self.is_heterogeneous(),
            "node_types": self.node_types(),
            "edge_types": self.edge_types(),
        }


def parse_parameter_sheet(df: pd.DataFrame) -> ExcelGraphSpec:
    """Validate and parse the Parameter sheet DataFrame into an ExcelGraphSpec."""
    if df is None or df.empty:
        raise ValueError("Parameter sheet is empty.")

    col_lookup = {str(c).strip(): c for c in df.columns}
    canonical = {k.lower(): v for k, v in col_lookup.items()}
    missing = [c for c in REQUIRED_PARAMETER_COLUMNS if c.lower() not in canonical]
    if missing:
        raise ValueError(
            f"Parameter sheet missing required columns: {missing}. "
            f"Expected columns: {REQUIRED_PARAMETER_COLUMNS} (+ optional 'Weight')."
        )

    def _get(row, key: str):
        return row[canonical[key.lower()]]

    has_weight = "weight" in canonical
    entries: list[ParameterEntry] = []

    for idx, row in df.iterrows():
        xy_raw = _get(row, "XY")
        level_raw = _get(row, "Level")
        type_raw = _get(row, "Type")
        param_raw = _get(row, "Parameter")

        if all(pd.isna(v) or str(v).strip() == "" for v in (xy_raw, level_raw, type_raw, param_raw)):
            continue

        xy = str(xy_raw).strip().upper() if not pd.isna(xy_raw) else ""
        level = str(level_raw).strip().capitalize() if not pd.isna(level_raw) else ""
        type_ = str(type_raw).strip() if not pd.isna(type_raw) else ""
        parameter = str(param_raw).strip() if not pd.isna(param_raw) else ""

        if xy not in VALID_XY:
            raise ValueError(
                f"Parameter sheet row {idx + 2}: XY must be 'X' or 'Y', got {xy_raw!r}."
            )
        if level not in VALID_LEVELS:
            raise ValueError(
                f"Parameter sheet row {idx + 2}: Level must be one of {VALID_LEVELS}, "
                f"got {level_raw!r}."
            )
        if not type_:
            raise ValueError(f"Parameter sheet row {idx + 2}: Type is required.")
        if not parameter:
            raise ValueError(f"Parameter sheet row {idx + 2}: Parameter name is required.")

        weight: Optional[float] = None
        if xy == "Y" and has_weight:
            w_raw = _get(row, "Weight")
            if not pd.isna(w_raw) and str(w_raw).strip() != "":
                try:
                    weight = float(w_raw)
                except (TypeError, ValueError):
                    raise ValueError(
                        f"Parameter sheet row {idx + 2}: Weight must be numeric, got {w_raw!r}."
                    )

        entries.append(ParameterEntry(
            xy=xy, level=level, type_=type_, parameter=parameter, weight=weight,
        ))

    if not entries:
        raise ValueError("Parameter sheet has no valid rows.")

    return ExcelGraphSpec(entries=entries)
