# Asian Font Self-Hosting Implementation Guide

このドキュメントは、日本語・中国語・韓国語（CJK）のWebフォントをローカルにホストするための実装ガイドです。
主に**中国国内からのアクセスを考慮し、Google Fonts等の外部CDNに依存しない**構成を実現します。

---

## 🎯 目的

- Google Fontsなどの外部CDNに依存せず、CJKフォントをローカルでホスト
- 中国のGreat Firewallの影響を受けない安定したフォント配信
- unicode-rangeを活用した効率的なフォントロード

---

## 📋 AI への指示テンプレート

### 基本的な指示

```
Noto Sans CJKフォントをローカルにホスティングする設定を実装してください。

【要件】
- 対象言語: 日本語(JP)、簡体字中国語(SC)、繁体字中国語(TC)、韓国語(KR)
- フォントウェイト: 400 (Regular) と 700 (Bold)
- 中国国内からもアクセス可能にする
- Google Fontsからフォントファイルとunicode-range定義を含むCSSを取得
- プロジェクトの<フォント格納ディレクトリ>にすべてのファイルを配置
- <CSSファイル名>にすべての@font-face定義を統合

【重要な技術要件】
1. Google Fonts CSS取得時は、必ずChrome User-Agentを使用してunicode-range付きの詳細版を取得すること
2. フォントファイルは.woff2形式
3. 各言語で数百個のフォントファイルがダウンロードされることを想定
4. すべてのフォントURLをローカルの相対パスに変換
```

### カスタマイズ可能なパラメータ

実際のプロジェクトに応じて以下を調整してください：

| パラメータ | 説明 | 例 |
|:----------|:-----|:---|
| **フォント格納ディレクトリ** | フォントファイルを保存するディレクトリ | `public/assets/fonts/`, `static/fonts/`, `src/assets/fonts/` |
| **CSSファイル名** | フォント定義を記述するCSSファイル | `custom.css`, `fonts.css`, `global.css` |
| **対象言語** | 必要な言語のみ選択 | JP, SC, TC, KR から選択 |
| **フォントウェイト** | 必要な太さ | 300, 400, 500, 700, 900 など |

---

## 🔧 実装の流れ（参考）

AIは以下のような流れで実装を進めます：

### 1. フォントディレクトリの作成

```bash
mkdir -p <フォント格納ディレクトリ>
```

### 2. Google Fonts CSSの取得

**重要**: 適切なUser-Agentを使用して**詳細版CSS**を取得

```powershell
$userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
$headers = @{ 
    'User-Agent' = $userAgent
    'Accept' = 'text/css,*/*;q=0.1'
}

# 各言語のCSS取得（例：日本語）
Invoke-WebRequest -Uri 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap' -Headers $headers
```

> ⚠️ **User-Agentなしや簡易的なUser-Agentでは、unicode-rangeを含まない簡略版CSSが返されます**

### 3. フォントファイルのダウンロード

CSSに含まれるすべてのフォントURL（`https://fonts.gstatic.com/...`）からフォントファイルをダウンロード

**予想されるファイル数**:
- 日本語（JP）: 約250ファイル
- 簡体字中国語（SC）: 約250ファイル  
- 繁体字中国語（TC）: 約250ファイル
- 韓国語（KR）: 約200ファイル
- **合計**: 約900〜1000ファイル（すべての言語を含む場合）

### 4. CSSのURL置換

取得したCSS内のすべてのフォントURLを、ローカル相対パスに置換

**変換例**:
```css
/* 元のURL */
url(https://fonts.gstatic.com/s/notosansjp/v55/-F62fjtqLzI2JPCgQBnw7HFow2oe2EcP5pp0erwTqsSWs9Jezazjcb4.0.woff2)

/* ローカルパス（変換後） */
url(./NotoSansJP-Regular-1.woff2)
```

### 5. 最終CSSファイルの生成

すべての言語の@font-face定義を1つのCSSファイルに統合し、グローバル適用のスタイルを追加

```css
/* 全ての@font-face定義 */
@font-face { ... }

/* グローバルフォント適用 */
body, body * {
  font-family: 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans KR', sans-serif !important;
}
```

---

## ⚠️ 重要な注意点

### Google Fonts API取得時の落とし穴

#### ❌ 間違った方法（簡略版CSSが返される）

```powershell
# User-Agentなし、または不適切
Invoke-WebRequest -Uri 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700'
```

**結果**: unicode-rangeを含まない簡略版（数百バイト）が返され、すべての文字に対して1つのフォントファイルしか参照されない

#### ✅ 正しい方法（詳細版CSSが返される）

```powershell
# 適切なChrome User-Agentを設定
$userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
$headers = @{ 'User-Agent' = $userAgent }
Invoke-WebRequest -Uri 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap' -Headers $headers
```

**結果**: unicode-rangeを含む詳細版（200〜250KB）が返され、文字範囲ごとに最適なフォントファイルが参照される

### ファイル数について

- CJKフォントは**文字数が膨大**なため、Google Fontsはunicode-rangeごとにファイルを分割
- **数百個のファイルは正常**です（例: 日本語だけで250個程度）
- これにより、**使用される文字のフォントファイルのみ**がブラウザでダウンロードされ、パフォーマンスが向上

### ファイルサイズ

- 最終的なCSSファイル: 約500KB〜1MB
- フォントファイル総サイズ: 約20〜40MB（すべての言語）
- ブラウザは必要な分だけダウンロードするため、実際のトラフィックはずっと少ない

---

## 🎨 プロジェクト別の調整例

### Next.js / React プロジェクト

```markdown
【プロジェクト情報】
- フレームワーク: Next.js
- フォント格納ディレクトリ: `public/fonts/`
- CSSファイル: `styles/fonts.css` (app/layout.tsxでインポート)
```

### Vue.js プロジェクト

```markdown
【プロジェクト情報】
- フレームワーク: Vue.js
- フォント格納ディレクトリ: `public/assets/fonts/`
- CSSファイル: `src/assets/css/fonts.css` (main.jsでインポート)
```

### 静的HTML

```markdown
【プロジェクト情報】
- 静的HTMLサイト
- フォント格納ディレクトリ: `fonts/`
- CSSファイル: `css/custom.css` (<link>でインポート)
```

---

## 📊 完成後の検証方法

AIに以下も依頼すると良いでしょう：

```markdown
【検証】
実装完了後、以下を確認してください：
1. フォントファイルが正しくディレクトリに配置されているか
2. CSSファイルのファイルサイズ（500KB以上が目安）
3. unicode-rangeが各@font-faceに含まれているか
4. ブラウザの開発者ツールで.woff2ファイルが正しくロードされるか
```

---

## 🚀 完全な指示例

以下は、実際にAIに渡す完全な指示の例です：

```markdown
Noto Sans CJKフォントをローカルにホスティングする設定を実装してください。

【要件】
- 対象言語: 日本語(JP)、簡体字中国語(SC)、繁体字中国語(TC)、韓国語(KR)
- フォントウェイト: 400 (Regular) と 700 (Bold)
- 中国国内からもアクセス可能にする
- Google Fontsからフォントファイルとunicode-range定義を含むCSSを取得
- プロジェクトの `public/fonts/` にすべてのファイルを配置
- `public/css/fonts.css` にすべての@font-face定義を統合

【重要な技術要件】
1. Google Fonts CSS取得時は、必ずChrome User-Agentを使用してunicode-range付きの詳細版を取得すること
2. フォントファイルは.woff2形式
3. 各言語で数百個のフォントファイルがダウンロードされることを想定
4. すべてのフォントURLをローカルの相対パスに変換

【検証】
実装完了後、以下を確認してください：
1. フォントファイルが正しく `public/fonts/` に配置されているか
2. `fonts.css` のファイルサイズが500KB以上あるか
3. unicode-rangeが各@font-faceに含まれているか
4. 最初の数個の@font-face定義を表示して確認
```

---

## 📝 補足: fonts.googleapis.cn について

`fonts.googleapis.cn` は中国向けのGoogle Fonts CDNですが：

- ❌ **非推奨**: 中国政府の方針により予告なく利用不可になる可能性
- ❌ **不安定**: 地域によってアクセスできない場合がある
- ✅ **推奨**: 完全にローカルホスティングする方が確実

---

## 🎯 まとめ

このガイドをAIに渡すことで：
- ✅ unicode-range付きの詳細版CSSを確実に取得
- ✅ 数百個のフォントファイルを正しくダウンロード
- ✅ 中国国内からアクセス可能なローカルホスティングを実現
- ✅ 効率的なフォントロードによるパフォーマンス最適化

**今後のプロジェクトでは、このガイドと一緒に具体的なプロジェクト情報を伝えることで、スムーズに実装できます！**
