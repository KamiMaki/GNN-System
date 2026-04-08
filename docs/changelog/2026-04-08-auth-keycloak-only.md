# Changelog: Auth 簡化為 Keycloak-Only

**日期**: 2026-04-08
**類型**: refactor
**範圍**: frontend auth

## 變更摘要

將前端驗證系統從雙模式（mock/keycloak）簡化為僅使用 Keycloak + NextAuth V5。

## 變更內容

### 新增
- 首頁 (`app/page.tsx`) 加入 server-side session 檢查，已登入導向 dashboard，未登入導向 login

### 修改
- `AuthContext.tsx`: 移除 MockAuthProvider，僅保留 KeycloakAuthProvider
- `ClientProviders.tsx`: 始終使用 SessionProvider，移除條件判斷
- `app/login/page.tsx`: 移除表單輸入、SSO provider 選擇、記住我等，僅保留標題、說明、登入按鈕
- `AppHeader.tsx`: 移除 Dropdown 選單，改為直接顯示 user info + logout 按鈕
- `.env.example`: 移除 `NEXT_PUBLIC_AUTH_MODE` 設定
- `AuthContext.test.tsx`: 重寫為 Keycloak-only 測試

### 刪除
- `src/lib/auth-mode.ts`: 不再需要雙模式切換邏輯
