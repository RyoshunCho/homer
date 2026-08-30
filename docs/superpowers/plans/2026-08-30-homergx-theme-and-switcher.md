# HomerGX Theme & Theme Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the HomerGX visual design (dark/light palettes, rounded card style, hover-expanding smart tags, wallpapers, fonts) as a new theme and add a navbar theme switcher button to cycle between all available themes.

**Architecture:** A new Vue component `ThemeSwitcher.vue` is placed in `Navbar.vue` alongside `DarkMode.vue`. It reads/writes `localStorage['homer-theme']` and emits theme change events. `App.vue` binds the reactive theme to `#app`. A dedicated stylesheet `src/assets/themes/homergx.scss` is added to the `@layer(theme)` cascade containing HomerGX's variables and component overrides. Wallpaper assets are copied to `public/assets/themes/homergx/`.

**Tech Stack:** Vue 3 (Options API), SCSS with CSS Cascade Layers (`@layer framework, base, theme`), Bulma 1.0, FontAwesome 6, Vite 7.

---

### Task 1: Copy HomerGX Wallpapers to Static Assets Directory

**Files:**
- Create directory: `public/assets/themes/homergx/`
- Create/Copy: `public/assets/themes/homergx/wall1.jpg`
- Create/Copy: `public/assets/themes/homergx/wall2.jpg`
- Create/Copy: `public/assets/themes/homergx/wall3.jpg`

- [ ] **Step 1: Create target directory**

```powershell
New-Item -ItemType Directory -Force -Path "public/assets/themes/homergx"
```

- [ ] **Step 2: Copy image assets from cloned HomerGX**

```powershell
Copy-Item "C:\Users\dinzz\AppData\Local\Temp\HomerGX\public\assets\img\wall1.jpg" "public/assets/themes/homergx/wall1.jpg"
Copy-Item "C:\Users\dinzz\AppData\Local\Temp\HomerGX\public\assets\img\wall2.jpg" "public/assets/themes/homergx/wall2.jpg"
Copy-Item "C:\Users\dinzz\AppData\Local\Temp\HomerGX\public\assets\img\wall3.jpg" "public/assets/themes/homergx/wall3.jpg"
```

- [ ] **Step 3: Verify assets exist and have expected non-zero file size**

Run: `Get-ChildItem -Path "public/assets/themes/homergx"`
Expected: 3 JPG files listed with sizes (~332KB, ~485KB, ~650KB)

- [ ] **Step 4: Commit assets**

```bash
git add public/assets/themes/homergx/
git commit -m "feat(assets): add HomerGX wallpaper assets"
```

---

### Task 2: Create HomerGX Theme SCSS & Register in App Styles

**Files:**
- Create: `src/assets/themes/homergx.scss`
- Modify: `src/assets/app.scss:9-13`

- [ ] **Step 1: Create `src/assets/themes/homergx.scss`**

```scss
// HomerGX Theme (Inspired by GeorgeGedox/HomerGX)
@import url("https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&family=Rubik:wght@300;400;500;600;700&display=swap");

.theme-homergx.light {
  --highlight-primary: rgba(232, 233, 255, 0.87);
  --highlight-secondary: #4d48e8;
  --highlight-hover: rgba(232, 233, 255, 1);
  --background: #e8e9ff;
  --card-background: rgba(232, 233, 255, 0.87);
  --surface-elevated: rgba(255, 255, 255, 0.9);
  --surface-soft: rgba(77, 72, 232, 0.08);
  --surface-border: rgba(0, 4, 75, 0.1);
  --input-background: rgba(255, 255, 255, 0.85);
  --header-surface: transparent;
  --focus-ring: rgba(77, 72, 232, 0.25);
  --text: #00044b;
  --text-header: #00044b;
  --text-title: #00044b;
  --text-subtitle: #161839;
  --card-shadow: rgba(0, 4, 75, 0.15);
  --link: #3255dc;
  --link-hover: #1830ae;
  --background-image: url("/assets/themes/homergx/wall2.jpg");
  --highlight-variant-inverted: #00044b;
}

.theme-homergx.dark {
  --highlight-primary: rgba(0, 48, 73, 0.84);
  --highlight-secondary: #d62828;
  --highlight-hover: rgba(0, 48, 73, 1);
  --background: #003049;
  --card-background: rgba(0, 48, 73, 0.84);
  --surface-elevated: rgba(4, 58, 88, 0.88);
  --surface-soft: rgba(247, 127, 0, 0.12);
  --surface-border: rgba(234, 226, 183, 0.14);
  --input-background: rgba(0, 36, 56, 0.7);
  --header-surface: transparent;
  --focus-ring: rgba(247, 127, 0, 0.35);
  --text: #eae2b7;
  --text-header: #eae2b7;
  --text-title: #f77f00;
  --text-subtitle: #eae2b7;
  --card-shadow: rgba(0, 0, 0, 0.5);
  --link: #eae2b7;
  --link-hover: #fcbf49;
  --background-image: linear-gradient(0deg, rgba(0, 0, 0, 0.8), rgba(0, 48, 73, 0.5)), url("/assets/themes/homergx/wall3.jpg");
  --highlight-variant-inverted: #eae2b7;
}

.theme-homergx {
  --border-radius: 14px;
  font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  .dashboard-title h1,
  .group-title,
  h1,
  h2,
  h3 {
    font-family: "Rubik", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .group-title {
    font-weight: 600;
    color: var(--text-header);
  }

  /* Card design */
  .card {
    border: none;
    border-radius: var(--border-radius);
    box-shadow: 0 4px 20px -2px var(--card-shadow);
    transition: transform 300ms cubic-bezier(0.165, 0.84, 0.44, 1), background-color 300ms cubic-bezier(0.165, 0.84, 0.44, 1);
    position: relative;
    overflow: visible;

    .title {
      font-family: "Rubik", sans-serif;
      font-weight: 700;
      color: var(--text-title);
    }

    .subtitle {
      color: var(--text-subtitle);
    }

    &:hover {
      transform: scale(0.98);

      .tag {
        height: auto;
        width: auto;
        color: #ffffff;
        padding: 0.1em 0.75em;

        .tag-text {
          display: inline;
        }
      }
    }

    /* Retractable smart tag */
    .tag {
      color: var(--text);
      background-color: var(--highlight-secondary);
      position: absolute;
      top: -2px;
      right: 1.2rem;
      height: 4px;
      width: 2rem;
      overflow: hidden;
      transition: all 0.25s ease-out;
      padding: 0;
      border-radius: 4px;
      z-index: 5;

      .tag-text {
        display: none;
        font-size: 0.75rem;
      }
    }
  }

  /* Ensure doc-link (memo/doc icons) doesn't overlap tag */
  .doc-link {
    top: 0.5rem;
    right: 3.5rem;
  }

  /* Header & Navbar */
  #bighead {
    .navbar-item {
      border-radius: var(--border-radius);
      transition: background-color 200ms ease, color 200ms ease;

      &:hover {
        background-color: var(--surface-soft);
      }
    }

    .search-bar input {
      border-radius: 999px;
      background-color: var(--input-background);
      border: 1px solid var(--surface-border);
      transition: width 200ms ease, background-color 200ms ease;
    }
  }
}
```

- [ ] **Step 2: Import `homergx.scss` in `src/assets/app.scss`**

Modify `src/assets/app.scss` to append `@import url("@/assets/themes/homergx.scss") layer(theme);` at the end:
```scss
// themes
@import url("@/assets/themes/classic.scss") layer(theme);
@import url("@/assets/themes/walkxcode.scss") layer(theme);
@import url("@/assets/themes/neon.scss") layer(theme);
@import url("@/assets/themes/homergx.scss") layer(theme);
```

- [ ] **Step 3: Run `pnpm build` to verify SCSS compilation**

Run: `pnpm build`
Expected: Build succeeds without CSS or Sass syntax errors.

- [ ] **Step 4: Commit SCSS theme changes**

```bash
git add src/assets/themes/homergx.scss src/assets/app.scss
git commit -m "feat(theme): add HomerGX stylesheet and register in app.scss"
```

---

### Task 3: Create `ThemeSwitcher.vue` Component

**Files:**
- Create: `src/components/ThemeSwitcher.vue`

- [ ] **Step 1: Implement `src/components/ThemeSwitcher.vue`**

```vue
<template>
  <a
    aria-label="Switch theme"
    class="navbar-item is-inline-block-mobile"
    :title="`Theme: ${currentThemeLabel}`"
    @click="cycleTheme()"
  >
    <i class="fas fa-palette fa-fw"></i>
  </a>
</template>

<script>
const THEMES = [
  { id: "default", label: "Classic" },
  { id: "homergx", label: "HomerGX" },
  { id: "walkxcode", label: "Walkxcode" },
  { id: "neon", label: "Neon" },
];

export default {
  name: "ThemeSwitcher",
  props: {
    defaultTheme: {
      type: String,
      default: "default",
    },
  },
  emits: ["updated"],
  data() {
    return {
      themes: THEMES,
      currentIndex: 0,
    };
  },
  computed: {
    currentTheme() {
      return this.themes[this.currentIndex].id;
    },
    currentThemeLabel() {
      return this.themes[this.currentIndex].label;
    },
  },
  created() {
    const savedTheme = localStorage.getItem("homer-theme");
    const initialThemeId = savedTheme || this.defaultTheme || "default";
    const foundIndex = this.themes.findIndex((t) => t.id === initialThemeId);

    this.currentIndex = foundIndex !== -1 ? foundIndex : 0;
    this.$emit("updated", this.currentTheme);
  },
  methods: {
    cycleTheme() {
      this.currentIndex = (this.currentIndex + 1) % this.themes.length;
      const newTheme = this.currentTheme;
      localStorage.setItem("homer-theme", newTheme);
      this.$emit("updated", newTheme);
    },
  },
};
</script>
```

- [ ] **Step 2: Run linter to verify formatting**

Run: `pnpm lint`
Expected: No lint or formatting errors in `ThemeSwitcher.vue`.

- [ ] **Step 3: Commit component**

```bash
git add src/components/ThemeSwitcher.vue
git commit -m "feat(ui): add ThemeSwitcher navbar button component"
```

---

### Task 4: Integrate `ThemeSwitcher` into `App.vue`

**Files:**
- Modify: `src/App.vue:5-10, 40-54, 110-140`

- [ ] **Step 1: Import and register `ThemeSwitcher` in `src/App.vue`**

In `<script>`:
```javascript
import ThemeSwitcher from "./components/ThemeSwitcher.vue";
```
Register in `components`:
```javascript
ThemeSwitcher,
```

- [ ] **Step 2: Add `currentTheme` to `data()` and initialize**

In `data()`:
```javascript
currentTheme: "default",
```

In `created()`:
Initialize `this.currentTheme = localStorage.getItem("homer-theme") || this.config.theme || "default";`

- [ ] **Step 3: Update `#app` class binding and Navbar slot**

In template `#app`:
Replace `` `theme-${config.theme}` `` with `` `theme-${currentTheme}` ``:
```vue
    :class="[
      `theme-${currentTheme}`,
      `page-${currentPage}`,
      isDark ? 'dark' : 'light',
      !config.footer ? 'no-footer' : '',
    ]"
```

In `<Navbar>` slot:
```vue
        <ThemeSwitcher
          :default-theme="config.theme"
          @updated="currentTheme = $event"
        />

        <DarkMode
          :default-value="config.defaults.colorTheme"
          @updated="isDark = $event"
        />
```

- [ ] **Step 4: Commit changes to `App.vue`**

```bash
git add src/App.vue
git commit -m "feat(app): wire ThemeSwitcher to reactive currentTheme on #app"
```

---

### Task 5: Add `homergx` Option to `ThemeChooser.vue`

**Files:**
- Modify: `src/components/services/ThemeChooser.vue:10-16`

- [ ] **Step 1: Add option for `theme-homergx`**

In `<template>`:
```vue
            <option value="" disabled selected>Available themes</option>
            <option value="theme-classic">classic</option>
            <option value="theme-homergx">homergx</option>
            <option value="theme-neon">neon</option>
            <option value="theme-walkxcode">walkxcode</option>
```

- [ ] **Step 2: Commit `ThemeChooser.vue`**

```bash
git add src/components/services/ThemeChooser.vue
git commit -m "feat(services): add homergx option to ThemeChooser service"
```

---

### Task 6: Full Verification & Build Check

**Files:** All modified files

- [ ] **Step 1: Run ESLint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 2: Run Production Build**

Run: `pnpm build`
Expected: Build passes with 0 errors and creates dist bundle.

- [ ] **Step 3: Commit any final formatting cleanups**

```bash
git status
```
Expected: Clean working tree.
