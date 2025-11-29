# Lark認証実装ガイド - 完全版

このドキュメントは、Lark (Feishu/飛書) 認証を実装する際のすべての落とし穴と解決策をまとめたものです。

## 前提条件の確認

AIに実装を依頼する前に、以下を必ず準備してください：

### 1. Lark Developer Console での設定

#### 必須権限（Scopes）
- ✅ `获取用户受雇信息` (contact:user.employee:readonly) - **これがないと `enterprise_email` が取得できない**
- ✅ `获取用户邮箱信息` (contact:user.email:readonly)
- ✅ `获取用户 user ID` (contact:user.employee_id:readonly)

#### Redirect URI の設定
- 完全一致が必要（末尾のスラッシュ、ポート番号、プロトコルすべて正確に）
- 例：`https://nav.lodgegeek.com/auth/callback`（スラッシュなし）

#### App Credentials
- `App ID` (例: `cli_a9a1d7e481389e1b`)
- `App Secret` (例: `JIpx57OYudZrj4FwSyO9gb4tGBaMwNfC`)

### 2. Lark 管理後台での設定

- ✅ Lark メールサービスが有効になっていること（`enterprise_email` 取得に必須）
- ✅ 対象ユーザーに企業メールアドレスが設定されていること

### 3. デプロイ環境の確認

**Tencent EdgeOne Pages** を使用する場合：
- Edge Functions を使用（serverless 関数）
- `_routes.json` でルーティング制御が必要
- ビルド出力ディレクトリは `dist`

## AIへの指示の出し方（完全版プロンプト）

```markdown
# Lark 認証の実装依頼

## 環境
- プラットフォーム: Tencent EdgeOne Pages
- Edge Functions: 使用（Node.js互換環境）
- フロントエンド: Vue.js + Vite（ビルド出力: `dist/`）

## 要件
@lodgegeek.com ドメインの企業メールアドレスを持つユーザーのみがアクセスできるように、Lark認証を実装してください。

## 重要な制約事項

### 1. メールアドレス検証
- **必須**: `enterprise_email` フィールドを使用（個人メール `email` へのフォールバック禁止）
- `enterprise_email` が取得できない場合は、詳細なエラーメッセージを表示

### 2. Cookie 設定
- `SameSite=Lax` を使用（`Strict` は使用禁止、クロスサイトリダイレクトで問題が発生）
- `HttpOnly=true`, `Secure=true` は必須
- 有効期限: 30日

### 3. レスポンスヘッダー処理
- Edge Function で静的コンテンツをプロキシする際、以下のヘッダーを**必ず削除**：
  - `Content-Encoding`
  - `Content-Length`
- 理由: EdgeOne Pages がこれらのヘッダーを含むが、Edge Function が既にデコードしているため、ブラウザで `ERR_CONTENT_DECODING_FAILED` エラーが発生する

### 4. ルーティング設定
- `_routes.json` を**必ず作成**
- 静的アセット（`/assets/*`, `/resources/*`, `/icons/*` など）は除外
- Edge Functions で全リクエストをインターセプト

### 5. Lark API 呼び出しの注意点
- Access Token 取得時、`grant_type: "authorization_code"` を**必ず含める**
- Access Token は `data.access_token` にネストされている
- UserInfo は `data` オブジェクト内にある
- UserInfo API URL: `https://open.larksuite.com/open-apis/authen/v1/user_info`

### 6. エラーハンドリング
- すべてのエラーで詳細なデバッグ情報を表示（本番環境でも有効にする）
- エラーページに「リトライ」ボタンを追加
- ユーザー情報（JSON）を `<pre>` タグで表示

## Lark App 認証情報
- App ID: `cli_a9a1d7e481389e1b`
- App Secret: `JIpx57OYudZrj4FwSyO9gb4tGBaMwNfC`
- Redirect URI: `https://nav.lodgegeek.com/auth/callback`
- 許可ドメイン: `lodgegeek.com`

## 実装ファイル
- `edge-functions/index.js` - ルートパス用
- `edge-functions/[[path]].js` - すべての他のパス用（`index.js` と同一内容）
- `_routes.json` - ルーティング設定

## 確認済みの問題と解決策
1. `SameSite=Strict` → 無限リダイレクトループ → `Lax` に変更
2. `Content-Encoding` ヘッダー残存 → ブラウザエラー → ヘッダー削除
3. `enterprise_email` 欠如 → 個人メールで認証成功 → フォールバック禁止
4. Redirect URI 二重エンコーディング → Lark エラー → エンコード削除
```

## つまずきポイント一覧と解決策

### 1. `_routes.json` の配置と内容

**問題**: Edge Functions が実行されない、または静的ファイルが優先される

**解決策**:
```json
{
    "version": 1,
    "include": ["/*"],
    "exclude": [
        "/assets/*",
        "/favicon.ico",
        "/robots.txt",
        "/manifest.json",
        "/icons/*",
        "/resources/*"
    ]
}
```

- プロジェクトルートに配置（Viteを使う場合は `public/` に配置してビルド時に `dist/` にコピー）

### 2. Cookie の `SameSite` 属性

**問題**: `SameSite=Strict` を使うと、Larkからのリダイレクト後にCookieが送信されず、無限ループが発生

**原因**: Lark → `/auth/callback` → `/` のリダイレクトがクロスサイトナビゲーションとみなされる

**解決策**: `SameSite=Lax` を使用

### 3. `Content-Encoding` ヘッダー

**問題**: `ERR_CONTENT_DECODING_FAILED` エラーが発生

**原因**: 
- EdgeOne Pages が `Content-Encoding: br` または `gzip` ヘッダーを返す
- Edge Function 内で `fetch(request)` すると、レスポンスは自動デコードされる
- しかし `Content-Encoding` ヘッダーは残る
- ブラウザが既にデコード済みのコンテンツを再度デコードしようとして失敗

**解決策**:
```javascript
const newHeaders = new Headers(response.headers);
newHeaders.delete("Content-Encoding");
newHeaders.delete("Content-Length");
return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
});
```

### 4. `enterprise_email` vs `email`

**問題**: 個人メールアドレス（Gmail など）でも認証が通ってしまう

**原因**: `email` フィールドは個人メール（工作邮箱）、`enterprise_email` が企業メール（企业邮箱）

**解決策**:
```javascript
const enterpriseEmail = userInfo.enterprise_email;
if (!enterpriseEmail) {
    // 詳細エラーを表示
}
// email へのフォールバック禁止
```

### 5. Lark Access Token API

**問題**: `invalid request, empty grant_type` エラー

**解決策**: リクエストボディに `grant_type: "authorization_code"` を追加

**問題**: Access Token が取得できない（`undefined`）

**解決策**: `data.data.access_token` ではなく `data.data?.access_token` を使用

### 6. Redirect URI のエンコーディング

**問題**: `redirect_uri request is invalid` エラー（code: 20029）

**原因**: `encodeURIComponent()` で二重エンコーディング

**解決策**: URL の `searchParams.set()` は自動エンコードするため、手動エンコード不要

### 7. Service Worker キャッシュ

**問題**: 認証コードを変更してもブラウザが古いバージョンを表示

**解決策**:
- デプロイ後、シークレットウィンドウでテスト
- または `/logout` エンドポイントで Service Worker をクリア

### 8. Edge Functions のデバッグ

**問題**: どこでエラーが発生しているか分からない

**解決策**:
```javascript
console.log(`[Debug] Request: ${request.method} ${url.pathname}`);
console.log(`[Debug] Login status: ${isLoggedIn}`);
console.log(`[Debug] Upstream Status: ${response.status}`);
```

EdgeOne Pages のログで確認可能

### 9. API レスポンスの解析

**問題**: UserInfo API から email が取得できない

**解決策**: Lark API ドキュメントを確認し、正しいエンドポイントとレスポンス構造を使用
- URL: `https://open.larksuite.com/open-apis/authen/v1/user_info`
- レスポンス: `responseJson.data.email`, `responseJson.data.enterprise_email`

## デバッグ時のチェックリスト

認証が動作しない場合、以下を順番に確認：

1. ☐ ブラウザのデブツール → Network タブでリクエストフローを確認
2. ☐ `/auth/callback` のレスポンスヘッダーで `Set-Cookie` を確認
3. ☐ `/` へのリクエストで Cookie が送信されているか確認
4. ☐ `X-Debug-Auth` ヘッダーの値を確認（`logged_in` or `redirecting`）
5. ☐ Application タブ → Cookies で `lark_internal_auth` の属性を確認
6. ☐ EdgeOne Pages のログで `console.log` 出力を確認
7. ☐ Lark Developer Console で権限設定を再確認

## 正常な認証フロー

```
1. ユーザーが / にアクセス
   ↓
2. Cookie なし → Edge Function が Lark へリダイレクト
   ↓
3. ユーザーが Lark で認証
   ↓
4. Lark が /auth/callback?code=xxx にリダイレクト
   ↓
5. Edge Function が code で Access Token を取得
   ↓
6. Access Token で UserInfo を取得
   ↓
7. enterprise_email を検証（ドメインチェック）
   ↓
8. Cookie を設定（SameSite=Lax）して / へリダイレクト（302）
   ↓
9. / へのリクエストで Cookie が送信される
   ↓
10. Edge Function が Cookie を検証 → 静的コンテンツを返す（200）
```

## まとめ

AIに依頼する際は、以下を必ず明示：
1. **プラットフォーム固有の制約**（EdgeOne Pages の仕様）
2. **既知の問題と解決策**（`SameSite=Lax`, `Content-Encoding` 削除）
3. **Lark API の正確な仕様**（権限、エンドポイント、レスポンス構造）
4. **デバッグ情報の出力**（本番環境でも有効）
5. **テスト手順**（シークレットウィンドウ、Cookie削除）

これらを含めることで、実装の試行錯誤を最小限に抑えられます。
