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
