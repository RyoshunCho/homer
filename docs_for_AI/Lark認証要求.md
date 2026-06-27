# Lark 認証実装要求（改訂版）

## 概要
Tencent EdgeOne Pages 環境で、Lark (Feishu) 認証を使用して企業メールドメインでのアクセス制限を実装する。

## プラットフォーム情報
- **デプロイ環境**: Tencent EdgeOne Pages
- **Edge Functions**: 使用（Node.js 互換 serverless 環境）
- **フロントエンド**: Vue.js + Vite
- **ビルド出力**: `dist/` ディレクトリ

## 認証要件

### 基本仕様
- **許可ドメイン**: `@lodgegeek.com` の企業メールアドレスを持つユーザーのみ
- **認証フロー**: OAuth 2.0 Authorization Code Flow
- **Cookie 有効期限**: 30日

### メールアドレス検証（重要）
- ✅ **必ず `enterprise_email` フィールドを使用**
- ❌ `email` フィールド（個人メール）へのフォールバック禁止
- `enterprise_email` が取得できない場合は詳細なエラーを表示：
  ```
  - Lark アプリの権限設定を確認
  - 管理後台でメールサービスが有効か確認
  - ユーザーに企業メールが設定されているか確認
  - 現在取得できているユーザー情報を JSON 形式で表示
  ```

## Lark App 設定情報

### Developer Console
- **App ID**: `cli_a9a1d7e481389e1b`
- **App Secret**: `JIpx57OYudZrj4FwSyO9gb4tGBaMwNfC`
- **Redirect URI**: `https://nav.lodgegeek.com/auth/callback`

### 必須権限（Scopes）
- `获取用户受雇信息` (contact:user.employee:readonly)
- `获取用户邮箱信息` (contact:user.email:readonly)
- `获取用户 user ID` (contact:user.employee_id:readonly)

## 技術実装の制約事項

### 1. Cookie 設定（必須）
```javascript
{
    name: "lark_internal_auth",
    maxAge: 2592000,  // 30日
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax"   // ⚠️ 必ず Lax（Strict は禁止）
}
```
**理由**: `Strict` を使うとクロスサイトリダイレクト時に Cookie が送信されず無限ループが発生

### 2. レスポンスヘッダー処理（必須）
Edge Function で静的コンテンツをプロキシする際、以下のヘッダーを削除：
```javascript
const newHeaders = new Headers(response.headers);
newHeaders.delete("Content-Encoding");
newHeaders.delete("Content-Length");
```
**理由**: EdgeOne Pages が圧縮済みコンテンツに `Content-Encoding` ヘッダーを付与するが、Edge Function 内で自動デコードされるため、ブラウザで二重デコードエラー (`ERR_CONTENT_DECODING_FAILED`) が発生

### 3. ルーティング設定（必須）
`_routes.json` をプロジェクトルートに作成：
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

### 4. Lark API 呼び出し仕様

#### Access Token 取得
- **エンドポイント**: `https://open.larksuite.com/open-apis/authen/v1/access_token`
- **メソッド**: POST
- **必須パラメータ**:
  ```javascript
  {
      app_id: CONFIG.LARK_APP_ID,
      app_secret: CONFIG.LARK_APP_SECRET,
      grant_type: "authorization_code",  // ⚠️ 必須（これがないとエラー）
      code: code
  }
  ```
- **レスポンス**: `data.data.access_token` を使用

#### UserInfo 取得
- **エンドポイント**: `https://open.larksuite.com/open-apis/authen/v1/user_info`
- **メソッド**: GET
- **ヘッダー**: `Authorization: Bearer {access_token}`
- **レスポンス**: 
  - `data.data.email` - 個人メール（工作邮箱）
  - `data.data.enterprise_email` - 企業メール（企业邮箱）⚠️ これを使う
  - `data.data.user_id`, `data.data.name` など

## ファイル構成

### Edge Functions
- `edge-functions/index.js` - ルートパス (`/`) 用
- `edge-functions/[[path]].js` - 全ての他のパス用（`index.js` と同一内容）

**理由**: EdgeOne Pages のファイルシステムルーティングで全パスをカバーするため

### ルーティング設定
- `_routes.json` - プロジェクトルート（または `public/` ディレクトリ）

## エラーハンドリング要件

### 1. 詳細なエラーページ
すべての認証エラーで以下を含む HTML ページを返す：
- エラーメッセージ（日本語・中国語対応）
- デバッグ情報（JSON 形式、`<pre>` タグで表示）
- 「リトライ」ボタン（`/` へのリンク）

### 2. ログ出力
すべての重要なステップで `console.log` を追加：
```javascript
console.log(`[Debug] Request: ${request.method} ${url.pathname}`);
console.log(`[Debug] Login status: ${isLoggedIn}`);
console.log(`[Debug] Upstream Status: ${response.status}`);
```

## テスト要件

### 1. 正常系
- ✅ `@lodgegeek.com` メールを持つユーザーがアクセスできる
- ✅ 認証後、Cookie が30日間有効
- ✅ Cookieがある状態で再訪問すると認証スキップ

### 2. 異常系
- ✅ 他のドメインのメールは拒否
- ✅ `enterprise_email` がない場合、詳細エラー表示
- ✅ 認証失敗時、リトライ可能

### 3. デバッグ用
- ✅ シークレットウィンドウで動作確認
- ✅ Cookie 削除後の再認証
- ✅ Network タブでリクエストフロー確認

## よくある問題と解決策

| 問題 | 原因 | 解決策 |
|------|------|--------|
| 無限リダイレクトループ | `SameSite=Strict` | `SameSite=Lax` に変更 |
| `ERR_CONTENT_DECODING_FAILED` | `Content-Encoding` ヘッダー残存 | ヘッダーを削除 |
| 個人メールで認証成功 | `email` フィールド使用 | `enterprise_email` に変更 |
| `redirect_uri request is invalid` | 二重エンコーディング | `searchParams.set()` を使用（手動エンコード不要） |
| `invalid request, empty grant_type` | パラメータ欠如 | `grant_type: "authorization_code"` を追加 |
| Edge Functions 動作しない | `_routes.json` 欠如 | ファイルを作成 |

## 実装時のチェックリスト

実装前：
- [ ] Lark Developer Console で権限を有効化
- [ ] Redirect URI を正確に設定
- [ ] Lark 管理後台でメールサービスを有効化

実装後：
- [ ] `_routes.json` が存在するか
- [ ] Cookie の `SameSite` が `Lax` か
- [ ] `Content-Encoding` ヘッダーを削除しているか
- [ ] `enterprise_email` を使用しているか
- [ ] エラーページにデバッグ情報があるか
- [ ] シークレットウィンドウでテスト済みか

## 参考資料

- [Lark

 Open API - User Authentication](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/authen/access_token)
- [Lark Open API - User Info](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/authen/user_info)
- [EdgeOne Pages Documentation](https://cloud.tencent.com/document/product/1552)

---

**注意**: このドキュメントは実際の実装経験に基づいており、すべての既知の問題と解決策を含んでいます。AIに依頼する際は、このドキュメント全体を提供してください。