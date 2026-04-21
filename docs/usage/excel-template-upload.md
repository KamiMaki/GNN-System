# Excel Template 上傳指南（Phase 1）

## 這是什麼

現在你可以用一個 `.xlsx` 檔案上傳整份 graph data，不再需要把 nodes / edges 拆成多個 CSV。Excel 的 Parameter sheet 會告訴後端：「哪些欄是 feature、哪些欄是 label、你想做哪種預測」。

## 快速開始

1. 進到專案 → **Upload** 頁 → 右上角「Download Template」下載空白 template。
2. 用 Excel / Google Sheets 打開，填好 4 個 sheet（規則見下）。
3. 回到 Upload 頁 → 點「Select .xlsx File」→ 選你剛才編輯好的檔案。
4. 上傳成功會自動跳到 Explore 頁，task type 與 label column 已自動偵測完成。

## 4 個 Sheet 怎麼填

### 1. Parameter sheet（必填）

這是契約。每一 row 描述一個 feature 或 label。

| XY  | Level | Type    | Parameter   | Weight |
|-----|-------|---------|-------------|--------|
| X   | Node  | default | X_1         |        |
| X   | Node  | default | X_2         |        |
| Y   | Node  | default | is_critical | 2.0    |
| X   | Edge  | default | wire_cap_ff |        |

- **XY**：`X` = 輸入特徵，`Y` = 預測目標
- **Level**：這個欄位屬於 `Node` / `Edge` / `Graph` 哪一層
- **Type**：sheet suffix（通常寫 `default` 就好；未來支援異質圖才會用到多個 type）
- **Parameter**：欄名 — 必須跟下面 `Node_default` / `Edge_default` / `Graph_default` sheet 裡的欄名完全一致
- **Weight**：僅 Y 列有意義；空白 = 1.0（Phase 1 先儲存不使用，Phase 2 才會套到 loss）

### 2. Node_default sheet

每一個節點一 row。欄名要對應 Parameter sheet 裡 `Level=Node` 的 `Parameter` 值。

| Graph_ID | Node | Type    | X_1 | X_2 | is_critical |
|----------|------|---------|-----|-----|-------------|
| 1        | 0    | default | 0.1 | 2.3 | 0           |
| 1        | 1    | default | 0.4 | 1.8 | 1           |

- `Node` 是節點 id（後端會 normalize 成 `node_id`）
- `Graph_ID` 區分多個圖（單一圖時全填 1 即可）

### 3. Edge_default sheet

| Graph_ID | Source_Node_ID | Target_Node_ID | Edge_Type | wire_cap_ff |
|----------|----------------|----------------|-----------|-------------|
| 1        | 0              | 1              | default   | 0.5         |

- `Source_Node_ID` / `Target_Node_ID` 後端會 normalize 成 `src_id` / `dst_id`

### 4. Graph_default sheet（只有做 graph prediction 才需要）

| Graph_ID | X_30 | graph_label |
|----------|------|-------------|
| 1        | 0.7  | 2.5         |

## Task type 怎麼決定

完全由 Parameter sheet 裡的 Y 列決定：

| Y 放在哪個 Level | 偵測到的 task       |
|------------------|---------------------|
| Node             | node_classification / node_regression |
| Graph            | graph_classification / graph_regression |
| Edge             | ❌ Phase 2 才支援 |

**分類 vs 回歸** 由 Y 欄的值型態自動判斷：整數且 ≤20 種值 → classification，否則 → regression。

## Phase 1 的限制（之後會解除）

1. **每個 Level 只能有一個 Type**：Parameter sheet 裡不能同時出現 `Node_default` + `Node_cell`，會直接拒絕上傳。
2. **只能有一個 Level 放 Y**：不能同時做 Node + Graph 多任務預測。
3. **Edge 不能放 Y**：還沒有 edge prediction 模型。
4. **Weight 會被記錄但不影響訓練**：Phase 2 才會套到多任務加權 loss。

上述任一違反都會顯示清楚的錯誤訊息並拒絕上傳，不會靜默降級。

## 疑難排解

| 錯誤訊息                                         | 原因                                  |
|--------------------------------------------------|---------------------------------------|
| `missing the required 'Parameter' sheet`         | 工作表名稱必須剛好是 `Parameter`       |
| `missing required columns: [...]`                | Parameter sheet 缺欄                   |
| `Label column 'X' is not present in data sheet`  | Parameter 宣告了某欄做 Y，但資料 sheet 沒這欄 |
| `Phase 1 supports only one Type per Level`       | 同一 Level 宣告了多個 Type             |
| `does not support edge-level prediction`         | Y 放在 Edge 上                         |
| `only one Y level`                               | 同時在 Node + Graph 都放了 Y           |
