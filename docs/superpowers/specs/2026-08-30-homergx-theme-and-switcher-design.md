# HomerGX テーマの導入およびテーマ切り替えボタンの追加 仕様書

## 1. 概要
[GeorgeGedox/HomerGX](https://github.com/GeorgeGedox/HomerGX) のデザイン（カラーパレット、カードアニメーション、スマートタグ、壁紙、タイポグラフィ）を取り入れ、ナビゲーションバーのボタンで既存テーマおよび HomerGX テーマを即座に切り替えられるようにする。

## 2. 目的とゴール
- **HomerGX デザインの統合**: HomerGX の特長であるダークモード配色（ペトロブルー背景、アンバーオレンジタイトル、クリムゾンレッドアクセント）、角丸カード、ホバー時スケールアニメーション、ホバー展開式スマートタグ、専用壁紙を Homer の CSS レイヤー機構に沿った新テーマ `homergx` として追加する。
- **ワンクリック巡回テーマスイッチャー**: ナビゲーションバーにパレットアイコン（`fa-palette`）を新設し、クリックごとに `Default (Classic)` → `HomerGX` → `Walkxcode` → `Neon` → `Default` と順繰りに切り替えられるようにする。
- **設定の永続化**: ユーザーが選択したテーマは `localStorage['homer-theme']` に保持し、ブラウザリロード後も選択状態を復元する。

## 3. 詳細設計

### 3.1 ナビゲーションバー・テーマスイッチャー (`src/components/ThemeSwitcher.vue`)
- **UI 表示**:
  - タグ: `<a class="navbar-item is-inline-block-mobile" :title="`Theme: ${currentThemeLabel}`" @click="cycleTheme">`
  - アイコン: `<i class="fas fa-palette fa-fw"></i>`
  - ツールチップ: ホバー時に現在のテーマ名（例: `Theme: HomerGX`）を表示。
- **サポートテーマ一覧**:
  1. `default`: Classic テーマ（標準）
  2. `homergx`: HomerGX テーマ
  3. `walkxcode`: Walkxcode テーマ
  4. `neon`: Neon テーマ
- **ライフサイクルと動作**:
  - `created` 時に `localStorage.getItem('homer-theme')` を取得。存在しない場合は props の `defaultTheme`（未指定時は `'default'`）を採用。
  - クリック時にインデックスを `(currentIndex + 1) % themes.length` で進めて切り替え。
  - 切り替え結果を `localStorage.setItem('homer-theme', theme)` に保存し、`this.$emit('updated', theme)` を発火。

### 3.2 `App.vue` との連携
- **コンポーネント配置**:
  - ナビバー（`Navbar.vue` の slot 内）の `DarkMode`、`SettingToggle` と並びで `<ThemeSwitcher :default-theme="config.theme" @updated="currentTheme = $event" />` を配置。
- **クラスバインディング**:
  - ルート要素 `#app` のクラスバインディングを、固定の ``theme-${config.theme}`` からリアクティブな変数 ``theme-${currentTheme}`` に変更。
  - これにより、テーマ切り替え時にページのリロードなしで即座にテーマクラス（`theme-homergx`, `theme-walkxcode`, `theme-neon`, `theme-default`）が更新される。
- **既存 `ThemeChooser.vue` サービスとの整合**:
  - ダッシュボードカード内の `ThemeChooser.vue`（`<select>`）にも `homergx` の選択肢を追加。

### 3.3 HomerGX テーマスタイル (`src/assets/themes/homergx.scss`)
- **レイヤー適用**:
  - `src/assets/app.scss` に `@import url("@/assets/themes/homergx.scss") layer(theme);` を追加。
- **カラーパレット & CSS 変数**:
  - **Light Mode (`.theme-homergx.light`)**:
    - `--highlight-primary`: `rgba(232, 233, 255, 0.87)`
    - `--highlight-secondary`: `#4d48e8`
    - `--highlight-hover`: `rgba(232, 233, 255, 1)`
    - `--background`: `rgba(232, 233, 255, 1)`
    - `--card-background`: `rgba(232, 233, 255, 0.87)`
    - `--surface-elevated`: `rgba(255, 255, 255, 0.9)`
    - `--surface-soft`: `rgba(77, 72, 232, 0.08)`
    - `--surface-border`: `rgba(0, 4, 75, 0.1)`
    - `--input-background`: `rgba(255, 255, 255, 0.85)`
    - `--header-surface`: `transparent`
    - `--text`: `#00044b`
    - `--text-header`: `#00044b`
    - `--text-title`: `#00044b`
    - `--text-subtitle`: `#161839`
    - `--link`: `#3255dc`
    - `--link-hover`: `#1830ae`
    - `--card-shadow`: `rgba(0, 0, 0, 0.15)`
    - `--background-image`: `url("/assets/themes/homergx/wall2.jpg")`
  - **Dark Mode (`.theme-homergx.dark`)**:
    - `--highlight-primary`: `rgba(0, 48, 73, 0.84)`
    - `--highlight-secondary`: `#d62828`
    - `--highlight-hover`: `rgba(0, 48, 73, 1)`
    - `--background`: `#003049`
    - `--card-background`: `rgba(0, 48, 73, 0.84)`
    - `--surface-elevated`: `rgba(4, 58, 88, 0.88)`
    - `--surface-soft`: `rgba(247, 127, 0, 0.12)`
    - `--surface-border`: `rgba(234, 226, 183, 0.12)`
    - `--input-background`: `rgba(0, 36, 56, 0.7)`
    - `--header-surface`: `transparent`
    - `--text`: `#EAE2B7`
    - `--text-header`: `#EAE2B7`
    - `--text-title`: `#F77F00`
    - `--text-subtitle`: `#EAE2B7`
    - `--link`: `#EAE2B7`
    - `--link-hover`: `#fcbf49`
    - `--card-shadow`: `rgba(0, 0, 0, 0.5)`
    - `--background-image`: `linear-gradient(0deg, rgba(0, 0, 0, 0.8), rgba(0, 48, 73, 0.5)), url("/assets/themes/homergx/wall3.jpg")`
- **コンポーネント固有スタイル (`.theme-homergx`)**:
  - `--border-radius: 14px;`
  - 見出し・タイトル用フォント: `Rubik, sans-serif`
  - 本文用フォント: `Nunito, sans-serif`
  - **カード**:
    - `border-radius: var(--border-radius);`
    - `border: none;`
    - ホバー時アニメーション: `transform: scale(0.98); transition: cubic-bezier(0.165, 0.84, 0.44, 1) 300ms;`
  - **スマートタグ（伸縮バッジ）**:
    - 初期状態: カード上部に幅2rem、高さ4pxの細いカラーバーとして待機（テキスト非表示）
    - ホバー時: 高さ・幅が auto に展開し、`#タグ名` がフェードイン表示
    - 位置: Homer の `.doc-link`（メモやドキュメントリンクアイコン）と干渉しないようオフセット調整
  - **ナビバー**:
    - アイテムに角丸（`border-radius: var(--border-radius)`）と背景ホバー効果
  - **検索バー**:
    - ピル型の角丸インプット、フォーカス時の幅拡大トランジション

### 3.4 静的アセット
- 壁紙画像:
  - HomerGX リポジトリから `wall1.jpg`, `wall2.jpg`, `wall3.jpg` を `public/assets/themes/homergx/` にコピー・配置。
- Webフォント:
  - `Nunito` および `Rubik` を Google Fonts（またはローカル定義）より読み込み。

## 4. 影響ファイル一覧
- [NEW] `docs/superpowers/specs/2026-08-30-homergx-theme-and-switcher-design.md`
- [NEW] `src/components/ThemeSwitcher.vue`
- [NEW] `src/assets/themes/homergx.scss`
- [NEW] `public/assets/themes/homergx/wall1.jpg`
- [NEW] `public/assets/themes/homergx/wall2.jpg`
- [NEW] `public/assets/themes/homergx/wall3.jpg`
- [MODIFY] `src/App.vue`
- [MODIFY] `src/assets/app.scss`
- [MODIFY] `src/components/services/ThemeChooser.vue`

## 5. 検証計画
1. **ビルド & リント**: `pnpm lint` および `pnpm build` がエラーなく通ることの確認。
2. **テーマ切り替え動作**:
   - ナビバーのパレットアイコンをクリックし、テーマが `Classic` → `HomerGX` → `Walkxcode` → `Neon` → `Classic` と順繰りに切り替わることを確認。
   - ブラウザリロード後も選択したテーマが保持されることを確認。
3. **HomerGX デザイン再現**:
   - ライトモード / ダークモード両方で HomerGX の配色・壁紙・フォントが正しく適用されていることの確認。
   - カードホバー時のスケールダウン効果（98%）が動作することの確認。
   - カードタグがホバー時にスムーズに展開すること、およびメモ/ドキュメントリンクと重複しないことの確認。
