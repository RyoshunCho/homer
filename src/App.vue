<template>
  <div
    v-if="config && isAuthChecked && isAuthenticated"
    id="app"
    :class="[
      `theme-${config.theme}`,
      `page-${currentPage}`,
      isDark ? 'dark' : 'light',
      !config.footer ? 'no-footer' : '',
    ]"
  >
    <DynamicTheme v-if="config.colors" :themes="config.colors" />
    <div id="bighead">
      <section v-if="config.header" class="first-line">
        <div v-cloak class="container">
          <div class="logo">
            <a href="#">
              <img v-if="config.logo" :src="config.logo" alt="dashboard logo" />
            </a>
            <i v-if="config.icon" :class="config.icon"></i>
          </div>
          <div class="dashboard-title">
            <span class="headline">{{ config.subtitle }}</span>
            <h1>{{ config.title }}</h1>
          </div>
          <div class="header-widgets">
            <ClockWidget />
            <WeatherWidget />
          </div>
        </div>
      </section>

      <Navbar
        :open="showMenu"
        :links="config.links"
        :user="user"
        :is-admin="isAdmin"
        @navbar-toggle="showMenu = !showMenu"
        @open-config-editor="showConfigEditor = true"
      >
        <DarkMode
          :default-value="config.defaults.colorTheme"
          @updated="isDark = $event"
        />

        <SettingToggle
          name="vlayout"
          icon="fa-list"
          icon-alt="fa-columns"
          :default-value="config.defaults.layout == 'columns'"
          @updated="vlayout = $event"
        />

        <SearchInput
          class="navbar-item is-inline-block-mobile"
          :hotkey="searchHotkey()"
          @input="filterServices($event)"
          @search-focus="showMenu = true"
          @search-open="navigateToFirstService"
          @search-cancel="filterServices()"
        />
      </Navbar>
    </div>
    <section id="main-section" class="section">
      <div v-cloak class="container">
        <ConnectivityChecker
          v-if="config.connectivityCheck"
          @network-status-update="offline = $event"
        />

        <GetStarted v-if="configurationNeeded" />

        <div v-if="!offline">
          <!-- Global Memo (Announcement Card) -->
          <GlobalMemo
            :global-memo="config.globalMemo"
            @saved="onGlobalMemoSaved"
          />

          <!-- Optional messages -->
          <Message :item="config.message" />

          <!-- Unified layout -->
          <div
            :class="[
              'columns',
              'is-multiline',
              { 'layout-vertical': vlayout && !filter },
            ]"
          >
            <ServiceGroup
              v-for="(group, groupIndex) in services"
              :key="`${currentPage}-${groupIndex}`"
              :group="group"
              :is-vertical="vlayout && !filter"
              :proxy="config.proxy"
              :columns="config.columns"
              :group-index="groupIndex"
            />
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="container">
        <div
          v-if="config.footer"
          class="content has-text-centered"
          v-html="config.footer"
        ></div>
      </div>
    </footer>

    <ConfigEditor
      :is-open="showConfigEditor"
      :is-dark="isDark"
      @close="showConfigEditor = false"
      @saved="onConfigSaved"
    />
  </div>
  <div v-else-if="!isAuthChecked" class="loading-overlay">
    <div class="loading-spinner"></div>
  </div>
</template>

<script>
import { parse } from "yaml";
import merge from "lodash.merge";

import Navbar from "./components/Navbar.vue";
import GetStarted from "./components/GetStarted.vue";
import ConnectivityChecker from "./components/ConnectivityChecker.vue";
import ServiceGroup from "./components/ServiceGroup.vue";
import Message from "./components/Message.vue";
import SearchInput from "./components/SearchInput.vue";
import SettingToggle from "./components/SettingToggle.vue";
import DarkMode from "./components/DarkMode.vue";
import DynamicTheme from "./components/DynamicTheme.vue";
import ClockWidget from "./components/ClockWidget.vue";
import WeatherWidget from "./components/WeatherWidget.vue";
import ConfigEditor from "./components/ConfigEditor.vue";
import GlobalMemo from "./components/GlobalMemo.vue";

import defaultConfig from "./assets/defaults.yml?raw";

export default {
  name: "App",
  components: {
    Navbar,
    GetStarted,
    ConnectivityChecker,
    ServiceGroup,
    Message,
    SearchInput,
    SettingToggle,
    DarkMode,
    DynamicTheme,
    ClockWidget,
    WeatherWidget,
    ConfigEditor,
    GlobalMemo,
  },
  data: function () {
    return {
      loaded: false,
      currentPage: null,
      configNotFound: false,
      config: null,
      services: null,
      offline: false,
      filter: "",
      vlayout: true,
      isDark: null,
      showMenu: false,
      user: null, // Add user property
      isAuthChecked: false,
      isAuthenticated: false,
      isAdmin: false,
      showConfigEditor: false,
    };
  },
  computed: {
    configurationNeeded: function () {
      return (this.loaded && !this.services) || this.configNotFound;
    },
  },
  created: async function () {
    this.buildDashboard();
    this.checkAuth(); // Call checkAuth
    this.checkAdminStatus();
    window.onhashchange = this.buildDashboard;
    this.loaded = true;
    console.info(`Homer v${__APP_VERSION__}`);
  },
  beforeUnmount() {
    window.onhashchange = null;
  },
  methods: {
    searchHotkey() {
      if (this.config.hotkey && this.config.hotkey.search) {
        return this.config.hotkey.search;
      }
    },
    buildDashboard: async function () {
      const defaults = parse(defaultConfig);
      let config;
      try {
        config = await this.getConfig();
        this.currentPage = window.location.hash.substring(1) || "default";

        if (this.currentPage !== "default") {
          let pageConfig = await this.getConfig(
            `assets/${this.currentPage}.yml`,
          );
          config = Object.assign(config, pageConfig);
        }
      } catch (error) {
        console.log(error);
        config = this.handleErrors("⚠️ Error loading configuration", error);
      }
      this.config = merge(defaults, config);
      this.services = this.config.services;

      document.title =
        this.config.documentTitle ||
        [this.config.title, this.config.subtitle].filter(Boolean).join(" | ");

      if (this.config.stylesheet) {
        let stylesheet = "";
        let addtionnal_styles = this.config.stylesheet;
        if (!Array.isArray(this.config.stylesheet)) {
          addtionnal_styles = [addtionnal_styles];
        }
        for (const file of addtionnal_styles) {
          stylesheet += `@import "${file}";`;
        }
        this.createStylesheet(stylesheet);
      }
    },
    getConfig: function (path = "assets/config.yml") {
      return fetch(path).then((response) => {
        if (response.status == 404 || response.redirected) {
          this.configNotFound = true;
          return {};
        }

        if (!response.ok) {
          throw Error(`${response.statusText}: ${response.body}`);
        }

        const that = this;
        return response
          .text()
          .then((body) => {
            return parse(body, { merge: true });
          })
          .then(function (config) {
            if (config.externalConfig) {
              return that.getConfig(config.externalConfig);
            }
            return config;
          });
      });
    },
    matchesFilter: function (item) {
      const needle = this.filter?.toLowerCase();
      return (
        item.name.toLowerCase().includes(needle) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(needle)) ||
        (item.tag && item.tag.toLowerCase().includes(needle)) ||
        (item.keywords && item.keywords.toLowerCase().includes(needle))
      );
    },
    navigateToFirstService: function (target) {
      try {
        const service = this.services[0].items[0];
        window.open(service.url, target || service.target || "_self");
      } catch {
        console.warn("fail to open service");
      }
    },
    filterServices: function (filter) {
      this.filter = filter;

      if (!filter) {
        this.services = this.config.services;
        return;
      }

      const searchResultItems = [];
      for (const group of this.config.services) {
        if (group.items !== null) {
          for (const item of group.items) {
            if (this.matchesFilter(item)) {
              searchResultItems.push(item);
            }
          }
        }
      }

      this.services = [
        {
          name: filter,
          icon: "fas fa-search",
          items: searchResultItems,
        },
      ];
    },
    handleErrors: function (title, content) {
      return {
        message: {
          title: title,
          style: "is-danger",
          content: content,
        },
      };
    },
    createStylesheet: function (css) {
      let style = document.createElement("style");
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
    },
    checkAuth: async function () {
      try {
        // Use local proxy to avoid CORS
        const res = await fetch(`/api/auth/verify`, {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            this.user = data.payload;
            this.isAuthenticated = true;
            console.log("User authenticated:", this.user);
          } else {
            this.redirectToLogin();
          }
        } else if (res.status === 401) {
          this.redirectToLogin();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        this.isAuthChecked = true;
      }
    },
    redirectToLogin() {
      const loginUrl = "https://auth.lodgegeek.com/login";
      window.location.href = `${loginUrl}?redirect_to=${encodeURIComponent(window.location.href)}`;
    },
    async checkAdminStatus() {
      try {
        const res = await fetch("/api/admin/check", {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          this.isAdmin = data.isAdmin === true;
          console.log("Admin status:", this.isAdmin);
        }
      } catch (error) {
        console.error("Admin check failed:", error);
        this.isAdmin = false;
      }
    },
    onConfigSaved() {
      // Refresh the page to apply the new config
      console.log("Config saved, refreshing...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onGlobalMemoSaved(updatedMemo) {
      // Update local globalMemo without page refresh
      if (this.config) {
        this.config.globalMemo = {
          ...this.config.globalMemo,
          ...updatedMemo,
        };
      }
      console.log("Global memo updated:", updatedMemo);
    },
  },
};
</script>

<style lang="scss">
#bighead {
  .first-line {
    .container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
  }
}

.logo {
  display: flex;
  align-items: center;
}

.dashboard-title {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  margin-right: auto; /* Push widgets to the right */
}

.header-widgets {
  display: flex;
  align-items: center;
  gap: 16px;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
    margin-top: 10px;
  }
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

@media (prefers-color-scheme: dark) {
  .loading-overlay {
    background: #121212;
  }
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(128, 128, 128, 0.1);
  border-radius: 50%;
  border-top-color: #3367d6;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

</style>
