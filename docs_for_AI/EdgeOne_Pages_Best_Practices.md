# EdgeOne Pages Best Practices for AI & Developers

このドキュメントは、Tencent EdgeOne Pages でプロジェクトを開発する際に、**ルーティングやEdge Functionsの仕様によるトラブルを回避するためのベストプラクティス**をまとめたものです。
AIエージェントに指示を出す際は、このドキュメントをコンテキストとして提供してください。

## 1. Edge Functions のディレクトリ構成

EdgeOne Pages のルーティング仕様（ファイルシステムベース）によるコードの重複や更新漏れを防ぐため、以下の構成を**強く推奨**します。

### 推奨構成
```
edge-functions/
├── _handler.js      # 【重要】すべてのロジックをここに集約
├── index.js         # ルートパス (/) 用のエントリポイント（ラッパー）
└── [[path]].js      # キャッチオール (/*) 用のエントリポイント（ラッパー）
```

### 各ファイルの役割と実装テンプレート

#### `_handler.js` (ロジック本体)
すべてのリクエスト処理（認証、プロキシ、API処理など）はここに記述します。
```javascript
// edge-functions/_handler.js
export default async function handleRequest(request) {
  const url = new URL(request.url);
  // ... ロジック ...
  return new Response("Hello from centralized logic");
}
```

#### `index.js` & `[[path]].js` (ラッパー)
これらは `_handler.js` を呼び出すだけに留め、**ロジックを一切記述しないでください**。
これにより、ルートパスとそれ以外のパスで挙動が不一致になるバグを完全に防げます。

```javascript
// edge-functions/index.js および edge-functions/[[path]].js
import handleRequest from './_handler.js';

export default function onRequest(context) {
    return handleRequest(context.request);
}
```

## 2. ルーティングの注意点

### `[[path]].js` の重要性
*   `index.js` はルート（`https://example.com/`）**のみ**にマッチします。
*   `https://example.com/api/foo` や `https://example.com/login` などのパスは、`[[path]].js` が処理します。
*   **注意**: `index.js` だけを修正して `[[path]].js` を忘れると、APIやサブページで古いロジックが動き続け、原因不明のバグ（CORSエラーやリダイレクトループ）になります。

### `_routes.json` の設定
静的アセット（画像、CSS、JS）に対して Edge Function を実行させないために、`_routes.json` で除外設定を行うことが重要です。

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/assets/*",
    "/favicon.ico",
    "/robots.txt"
  ]
}
```

## 3. AIへの指示出しテンプレート

新しいプロジェクトを開始する際、AIに以下のプロンプトを与えるとスムーズです。

```markdown
# EdgeOne Pages プロジェクト開発ルール

このプロジェクトは Tencent EdgeOne Pages を使用します。以下のルールを厳守してください。

1. **Edge Functions の構成**:
   - ロジックはすべて `edge-functions/_handler.js` に記述してください。
   - `edge-functions/index.js` と `edge-functions/[[path]].js` は、`_handler.js` をインポートして呼び出すだけのラッパーとして作成してください。
   - これにより、ルートパスとサブパスでロジックを共通化します。

2. **ルーティング**:
   - `_routes.json` を作成し、静的アセット（`/assets/*` 等）を除外してください。

3. **参照**:
   - 公式Example: https://github.com/TencentEdgeOne/pages-templates/tree/main/examples
```
