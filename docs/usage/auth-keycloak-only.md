# 使用指南: Keycloak 登入

## 概述

GraphX.AI 使用 Keycloak 作為唯一的身份驗證方式，透過 NextAuth V5 整合 OIDC 協議。

## 環境設定

在 `frontend/.env.local` 中設定以下變數：

```env
AUTH_SECRET=<用 npx auth secret 生成>
AUTH_KEYCLOAK_ID=your-client-id
AUTH_KEYCLOAK_SECRET=your-client-secret
AUTH_KEYCLOAK_ISSUER=https://your-keycloak-server/realms/your-realm
```

## 使用流程

1. **進入首頁**: 系統自動檢查 session，未登入會跳轉到登入頁
2. **登入頁**: 點擊「Sign in with Keycloak」按鈕
3. **Keycloak 登入**: 跳轉至 Keycloak 登入頁面完成驗證
4. **進入系統**: 登入成功後自動導向 Dashboard，Header 顯示使用者資訊
5. **登出**: 點擊 Header 右側的 Logout 按鈕，回到登入頁

## 注意事項

- 需要先在 Keycloak 中建立 realm 和 client
- Client 需設定正確的 redirect URI（如 `http://localhost:3000/api/auth/callback/keycloak`）
- AUTH_SECRET 必須設定，否則 NextAuth 無法運作
