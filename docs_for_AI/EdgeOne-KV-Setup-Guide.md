# EdgeOne KV Setup Guide

このガイドでは、`config.yml` を EdgeOne KV に配置して、デプロイなしで設定を変更できるようにする手順を説明します。

## ステップ 1: EdgeOne KV Namespace の作成

1. **EdgeOne コンソールにログイン**
   - https://console.cloud.tencent.com/edgeone にアクセス

2. **KV Namespace を作成**
   - 左メニューから「Edge Functions」→「KV Storage」を選択
   - 「Create Namespace」をクリック
   - Namespace 名: `CONFIG_KV`（または任意の名前）
   - 作成後、Namespace ID をメモ

## ステップ 2: config.yml を KV にアップロード

### 方法 A: EdgeOne ダッシュボード（推奨）

1. **KV Namespace の管理画面を開く**
   - 作成した `CONFIG_KV` をクリック

2. **新しいキーを追加**
   - 「Add Key-Value Pair」をクリック
   - Key: `config.yml`
   - Value: 以下のファイルの内容をコピー＆ペースト
     - `c:\dev\homer\public\assets\config.yml`
   - 「Save」をクリック

### 方法 B: Tencent Cloud CLI（オプション）

```bash
# CLI がインストールされている場合
tccli edgeone PutKVValue \
  --namespace-id <YOUR_NAMESPACE_ID> \
  --key "config.yml" \
  --value "$(cat ./public/assets/config.yml)"
```

## ステップ 3: KV バインディングを EdgeOne Pages に追加

1. **EdgeOne Pages のプロジェクト設定を開く**
   - EdgeOne コンソール → 「Pages」 → あなたのプロジェクト

2. **環境変数/バインディングを設定**
   - 「Settings」→「Environment Variables」または「Bindings」
   - 「Add Binding」をクリック

3. **KV バインディングを追加**
   - Type: `KV Namespace`
   - Variable Name: `CONFIG_KV`
   - KV Namespace: 先ほど作成した Namespace を選択
   - 保存

## ステップ 4: デプロイ

### Git にプッシュ

```bash
cd c:\dev\homer
git add edge-functions/index.js
git commit -m "feat: Add EdgeOne KV support for external config.yml"
git push
```

EdgeOne Pages が自動的にデプロイを開始します。

## ステップ 5: 動作確認

### 5.1 レスポンスヘッダーの確認

```bash
curl -I https://nav.lodgegeek.com/assets/config.yml
```

期待されるヘッダー:
```
HTTP/2 200
content-type: application/x-yaml; charset=utf-8
cache-control: public, max-age=300
x-config-source: edgeone-kv
```

### 5.2 内容の確認

```bash
curl https://nav.lodgegeek.com/assets/config.yml
```

KV にアップロードした YAML の内容が表示されることを確認。

### 5.3 アプリケーションの動作確認

ブラウザで https://nav.lodgegeek.com にアクセスして、Homer が正常に表示されることを確認。

## 今後の設定変更方法

### デプロイなしで設定を変更する手順

1. **EdgeOne コンソールにアクセス**
   - KV Namespace の管理画面を開く

2. **config.yml を編集**
   - `config.yml` キーをクリック
   - 値を編集（例: title やサービスを変更）
   - 保存

3. **変更の反映**
   - 最大 5 分でキャッシュが更新されます
   - すぐに確認したい場合:
     - ブラウザで強制リロード（Ctrl+Shift+R）
     - または EdgeOne でキャッシュパージを実行

4. **確認**
   - アプリケーションにアクセスして変更が反映されていることを確認

## トラブルシューティング

### config.yml が KV から配信されない場合

1. **ログを確認**
   - EdgeOne の Edge Function ログを確認
   - `[Config] KV binding not found` が表示される場合
     → バインディングが正しく設定されているか確認

2. **KV の値を確認**
   - KV Namespace に `config.yml` キーが存在するか確認
   - 値が正しいか確認

3. **フォールバック**
   - KV が利用できない場合、静的ファイル（`public/assets/config.yml`）にフォールバックします

### キャッシュがクリアされない場合

- EdgeOne コンソールで「Cache Purge」を実行
- URL パターン: `/assets/config.yml`

## 参考情報

- EdgeOne KV Documentation: [EdgeOne 公式ドキュメント]
- Edge Functions Documentation: [EdgeOne Edge Functions]
