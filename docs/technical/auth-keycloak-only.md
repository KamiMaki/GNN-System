# 技術文件: Auth Keycloak-Only 重構

## 這次改了什麼 (What Changed)

| 操作 | 檔案 |
|------|------|
| 刪除 | `frontend/src/lib/auth-mode.ts` |
| 修改 | `frontend/src/contexts/AuthContext.tsx` |
| 修改 | `frontend/src/components/ClientProviders.tsx` |
| 修改 | `frontend/app/login/page.tsx` |
| 修改 | `frontend/src/components/AppHeader.tsx` |
| 修改 | `frontend/app/page.tsx` |
| 修改 | `frontend/.env.example` |
| 修改 | `frontend/src/contexts/__tests__/AuthContext.test.tsx` |

## 為什麼這樣做 (Why)

原本系統支援 mock 和 keycloak 兩種驗證模式，增加了不必要的複雜度。實際生產環境只使用 Keycloak OIDC，mock 模式僅用於開發但也帶來維護負擔。簡化為單一模式可以：

- 減少條件分支，降低 bug 風險
- 簡化測試（不需要測兩套驗證邏輯）
- 減少程式碼量（刪除 ~220 行）

## 怎麼運作的 (How It Works)

### 驗證流程

```
使用者訪問首頁 (/)
  ↓
app/page.tsx (server component)
  → auth() 檢查 session
  → 有 session → redirect('/dashboard')
  → 無 session → redirect('/login')
  ↓
login/page.tsx
  → 點擊「Sign in with Keycloak」
  → signIn('keycloak') → 跳轉 Keycloak IdP
  → 驗證成功 → callback → session 建立
  → redirect('/dashboard')
```

### 模組關係

```
auth.ts (NextAuth config)
  ├── Keycloak provider (OIDC)
  ├── JWT callback (token enrichment)
  └── Session callback (user mapping)

ClientProviders
  └── SessionProvider (always)
      └── AuthProvider (useSession)
          └── AuthGuard (redirect if no session)

AppHeader
  └── useAuth() → user info + logout button
```

### AuthContext 簡化

移除 `MockAuthProvider` 和 `KeycloakAuthProvider` 雙實作，改為單一 `AuthProvider` 直接使用 `useSession()`：

- `login()` → `signIn('keycloak')`
- `logout()` → `signOut({ redirectTo: '/login' })`
- `user` → 從 `session.user` 映射

### Header 簡化

移除 Dropdown 選單（Profile、Settings 等 placeholder），改為直接在 header bar 顯示：
- Avatar + 使用者名稱 + Logout 按鈕

## 使用方式 (Usage)

```tsx
// 在任何 client component 中取得驗證狀態
import { useAuth } from '@/contexts/AuthContext';

const { user, isLoading, initialized, login, logout } = useAuth();
```

## 注意事項 (Caveats)

- 移除 mock 模式後，開發時必須連接 Keycloak（或設定本地 Keycloak Docker）
- `app/page.tsx` 改為 async server component，使用 `auth()` 做 server-side session 檢查
- `AUTH_SECRET` 環境變數為必填，否則 NextAuth 會報錯
