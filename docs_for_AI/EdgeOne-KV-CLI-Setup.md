# EdgeOne KV Setup via Tencent Cloud CLI

このガイドでは、Tencent Cloud CLI（tccli）を使用して EdgeOne KV をセットアップします。

## 前提条件

✅ **Tencent Cloud CLI がインストールされました**

## ステップ 1: CLI の初期設定

Tencent Cloud の API 認証情報を設定します。

### 1.1 API キーを取得

1. [Tencent Cloud Console](https://console.cloud.tencent.com/) にログイン
2. 右上のアカウント名をクリック → 「Access Management」→「API Keys」
3. 「Create Key」をクリックして SecretId と SecretKey を取得
4. **重要**: SecretKey は一度しか表示されないので、必ず保存してください

### 1.2 CLI を設定

> [!WARNING]
> 以下のコマンドを実行する前に、Tencent Cloud Console で API キーを取得してください。

```powershell
# 対話的に設定（推奨）
python -m tccli configure

# または、直接指定
python -m tccli configure set secretId <YOUR_SECRET_ID>
python -m tccli configure set secretKey <YOUR_SECRET_KEY>
python -m tccli configure set region ap-guangzhou
```

入力する情報:
- **secretId**: 取得した SecretId
- **secretKey**: 取得した SecretKey  
- **region**: `ap-guangzhou`（またはお好みのリージョン）

## ステップ 2: EdgeOne KV Namespace の作成

### 2.1 EdgeOne Zone ID を確認

まず、EdgeOne のサイト（Zone）ID を確認します。

```powershell
# EdgeOne のサイト一覧を取得
python -m tccli teo DescribeZones
```

出力から `ZoneId` をコピーしてメモします（例: `zone-xxx`）。

### 2.2 KV Namespace を作成

> [!NOTE]
> **現時点での制限**: EdgeOne KV の CLI コマンドは、EdgeOne のバージョンや API によって異なる可能性があります。
> 以下は一般的なパターンですが、公式ドキュメントを確認してください。

```powershell
# KV Namespace を作成（コマンドは EdgeOne のバージョンによって異なる可能性があります）
python -m tccli teo CreateKVNamespace `
  --ZoneId "zone-xxx" `
  --NamespaceName "CONFIG_KV" `
  --Description "Configuration storage for Homer dashboard"
```

**成功した場合の出力例:**
```json
{
  "NamespaceId": "ns-xxxxx",
  "RequestId": "xxxxx"
}
```

`NamespaceId` をメモします。

## ステップ 3: config.yml を KV にアップロード

### 3.1 config.yml の内容を base64 エンコード（必要な場合）

EdgeOne KV API によっては、バイナリデータとして扱う必要がある場合があります。

```powershell
# PowerShell で base64 エンコード
$configContent = Get-Content -Path ".\public\assets\config.yml" -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($configContent)
$base64 = [Convert]::ToBase64String($bytes)
echo $base64 | Out-File -FilePath ".\config_base64.txt" -Encoding ASCII

# または、そのまま使用
$configContent = Get-Content -Path ".\public\assets\config.yml" -Raw
```

### 3.2 KV にアップロード

> [!IMPORTANT]
> **EdgeOne KV API の制限**: 
> EdgeOne KV への書き込みは、現時点で CLI から直接サポートされていない可能性があります。
> その場合は、EdgeOne ダッシュボードを使用してください。

**もし CLI でサポートされている場合:**

```powershell
# KV にキー・バリューをアップロード
python -m tccli teo PutKVValue `
  --ZoneId "zone-xxx" `
  --NamespaceId "ns-xxxxx" `
  --Key "config.yml" `
  --Value "$configContent"
```

**代替案: EdgeOne ダッシュボードを使用**

1. EdgeOne Console → あなたのサイト → 「Edge Functions」→「KV Storage」
2. 作成した Namespace をクリック
3. 「Add Key-Value Pair」をクリック
4. Key: `config.yml`
5. Value: `public\assets\config.yml` の内容をコピー＆ペースト
6. 保存

## ステップ 4: EdgeOne Pages に KV バインディングを追加

### 4.1 Pages のプロジェクト ID を確認

```powershell
# Pages のプロジェクト一覧を取得
python -m tccli teo DescribeApplicationProxies --ZoneId "zone-xxx"
```

### 4.2 環境変数/バインディングを追加

> [!NOTE]
> **現時点での制限**: EdgeOne Pages のバインディング設定は、ダッシュボードから行う方が確実です。

**EdgeOne Console で設定（推奨）:**

1. EdgeOne Console → 「Pages」→ あなたのプロジェクト
2. 「Settings」→「Bindings」または「Environment Variables」
3. 「Add Binding」をクリック
4. Type: `KV Namespace`
5. Variable Name: `CONFIG_KV`
6. KV Namespace: 作成した Namespace を選択
7. 保存

## ステップ 5: 確認

### 5.1 KV の内容を確認

```powershell
# KV から値を取得
python -m tccli teo GetKVValue `
  --ZoneId "zone-xxx" `
  --NamespaceId "ns-xxxxx" `
  --Key "config.yml"
```

### 5.2 Namespace の一覧を確認

```powershell
# KV Namespace の一覧を取得
python -m tccli teo DescribeKVNamespaces --ZoneId "zone-xxx"
```

## よくある問題

### 問題1: `tccli` コマンドが見つからない

**解決策:**
```powershell
# tccli の代わりに python -m tccli を使用
python -m tccli --version
```

### 問題2: API エラー「InvalidParameter」

**原因**: ZoneId や NamespaceId が間違っている可能性があります。

**解決策**: 
- `DescribeZones` で正しい ZoneId を確認
- EdgeOne Console で Namespace ID を確認

### 問題3: EdgeOne KV の CLI コマンドが見つからない

**原因**: EdgeOne の API バージョンや製品名が異なる可能性があります。

**解決策**:
```powershell
# 利用可能な EdgeOne のコマンドを確認
python -m tccli teo help

# または、EdgeOne のサービス名を確認
python -m tccli configure list
```

## 次のステップ

1. ✅ Tencent Cloud CLI をインストール
2. ⏭️ API キーを設定
3. ⏭️ EdgeOne Zone ID を確認
4. ⏭️ KV Namespace を作成
5. ⏭️ config.yml をアップロード（ダッシュボード推奨）
6. ⏭️ EdgeOne Pages にバインディングを追加
7. ⏭️ Git にプッシュしてデプロイ

## 参考リンク

- [Tencent Cloud CLI Documentation](https://cloud.tencent.com/document/product/440/6176)
- [EdgeOne API Documentation](https://cloud.tencent.com/document/product/1552)
- [EdgeOne KV Documentation](https://cloud.tencent.com/document/product/1552/81929)
