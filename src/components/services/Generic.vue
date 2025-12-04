<template>
  <div>
    <div class="card" :style="`background-color:${item.background};`">
      <div v-if="hasAnyExtra" class="doc-link" @click.stop>
        <span
          class="memo-icon"
          :class="{ 'has-memo': item.memo }"
          @click="openMemoEditor"
          @mouseenter="showMemoTooltip"
          @mouseleave="hideMemoTooltip"
        >📝</span>
        <a
          v-if="item.doc"
          :href="item.doc"
          target="_blank"
          rel="noreferrer"
        >📙</a>
        <a
          v-if="item.video"
          :href="item.video"
          target="_blank"
          rel="noreferrer"
        >📺</a>
      </div>
      <a :href="item.url" :target="item.target || '_blank'" rel="noreferrer">
        <div class="card-content">
          <div :class="mediaClass">
            <slot name="icon">
              <div v-if="item.logo" class="media-left">
                <figure class="image is-48x48">
                  <img :src="item.logo" :alt="`${item.name} logo`" />
                </figure>
              </div>
              <div v-if="item.icon" class="media-left">
                <figure class="image is-48x48">
                  <i style="font-size: 32px" :class="['fa-fw', item.icon]"></i>
                </figure>
              </div>
            </slot>
            <div class="media-content">
              <slot name="content">
                <p class="title">{{ item.name }}</p>
                <p v-if="item.quick" class="quicklinks">
                  <a
                    v-for="(link, linkIndex) in item.quick"
                    :key="linkIndex"
                    :style="`background-color:${link.color};`"
                    :href="link.url"
                    :target="link.target || '_blank'"
                    rel="noreferrer"
                  >
                    <span v-if="link.icon"
                      ><i
                        style="font-size: 12px"
                        :class="['fa-fw', link.icon]"
                      ></i
                    ></span>
                    {{ link.name }}
                  </a>
                </p>
                <p v-if="item.subtitle" class="subtitle">
                  {{ item.subtitle }}
                </p>
              </slot>
            </div>
            <slot name="indicator" class="indicator"></slot>
          </div>
          <div v-if="item.tag" class="tag" :class="item.tagstyle">
            <strong class="tag-text">#{{ item.tag }}</strong>
          </div>
        </div>
      </a>
    </div>

    <!-- Memo Tooltip (Teleport to body) -->
    <Teleport to="body">
      <div
        v-if="showTooltip && item.memo"
        class="memo-tooltip"
        :style="tooltipStyle"
        @mouseenter="keepTooltip"
        @mouseleave="hideMemoTooltip"
      >
        <div class="memo-content">{{ item.memo }}</div>
      </div>

      <!-- Memo Editor Modal -->
      <div v-if="showEditor" class="memo-editor-overlay" @click.self="cancelEdit">
        <div class="memo-editor-modal">
          <div class="modal-header">
            <h3>📝 メモを編集</h3>
            <button class="close-btn" @click="cancelEdit" title="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <textarea
              v-model="editContent"
              placeholder="メモを入力..."
              rows="5"
              ref="memoTextarea"
            ></textarea>
          </div>
          <div class="modal-footer">
            <span v-if="saving" class="saving-indicator">
              <i class="fas fa-spinner fa-spin"></i> 保存中...
            </span>
            <span v-if="saveError" class="error-indicator">
              <i class="fas fa-exclamation-circle"></i> {{ saveError }}
            </span>
            <div class="footer-actions">
              <button class="btn btn-secondary" @click="cancelEdit" :disabled="saving">
                キャンセル
              </button>
              <button class="btn btn-primary" @click="saveMemo" :disabled="saving">
                <i class="fas fa-save"></i> 保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
export default {
  name: "Generic",
  props: {
    item: Object,
  },
  data() {
    return {
      showTooltip: false,
      showEditor: false,
      tooltipX: 0,
      tooltipY: 0,
      editContent: "",
      saving: false,
      saveError: null,
      hoverTimeout: null,
    };
  },
  computed: {
    mediaClass: function () {
      return { media: true, "no-subtitle": !this.item.subtitle };
    },
    hasAnyExtra: function () {
      return this.item.id || this.item.memo || this.item.doc || this.item.video;
    },
    tooltipStyle: function () {
      return {
        left: `${this.tooltipX}px`,
        top: `${this.tooltipY}px`,
      };
    },
  },
  methods: {
    showMemoTooltip(event) {
      if (!this.item.memo) return;
      
      const rect = event.target.getBoundingClientRect();
      this.tooltipX = rect.left;
      this.tooltipY = rect.bottom + 8;
      
      this.hoverTimeout = setTimeout(() => {
        this.showTooltip = true;
      }, 300);
    },
    keepTooltip() {
      clearTimeout(this.hoverTimeout);
    },
    hideMemoTooltip() {
      clearTimeout(this.hoverTimeout);
      this.showTooltip = false;
    },
    openMemoEditor() {
      this.hideMemoTooltip();
      this.editContent = this.item.memo || "";
      this.showEditor = true;
      this.saveError = null;
      this.$nextTick(() => {
        this.$refs.memoTextarea?.focus();
      });
    },
    cancelEdit() {
      if (this.saving) return;
      this.showEditor = false;
      this.editContent = "";
      this.saveError = null;
    },
    async saveMemo() {
      if (!this.item.id) {
        this.saveError = "サービスIDがありません";
        return;
      }

      this.saving = true;
      this.saveError = null;

      try {
        const response = await fetch("/api/config/memo", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceId: this.item.id,
            memo: this.editContent,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Failed: ${response.status}`);
        }

        // Update local item and close
        this.item.memo = this.editContent;
        this.showEditor = false;
      } catch (err) {
        console.error("Memo save failed:", err);
        this.saveError = err.message || "保存に失敗しました";
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.doc-link {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
  font-size: 1.5rem;

  a, .memo-icon {
    text-decoration: none;
    transition: transform 0.2s;
    display: inline-block;
    cursor: pointer;

    &:hover {
      transform: scale(1.3);
    }
  }

  .memo-icon {
    opacity: 0.3;
    
    &.has-memo {
      opacity: 1;
    }
  }
}

.media-left {
  .image {
    display: flex;
    align-items: center;
  }

  img {
    max-height: 100%;
    object-fit: contain;
  }
}

a[href=""] {
  pointer-events: none;
  cursor: default;
}

.quicklinks {
  float: right;
  a {
    font-size: 0.75rem;
    padding: 3px 6px;
    margin-left: 6px;
    border-radius: 100px;
    background-color: var(--background);
    z-index: 9999;
    pointer-events: all;
  }
}
</style>

<style lang="scss">
/* Non-scoped styles for Teleported content */
.memo-tooltip {
  position: fixed;
  max-width: 300px;
  padding: 10px 14px;
  background: var(--card-background, #ffffff);
  border: 1px solid var(--card-border, #e0e0e0);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 20000;
  font-size: 0.9rem;
  line-height: 1.5;

  .memo-content {
    user-select: text;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text, #333333);
  }
}

.memo-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20001;
  backdrop-filter: blur(2px);
}

.memo-editor-modal {
  background: var(--background, #ffffff);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-bottom: 1px solid var(--card-border, #e0e0e0);
    background: var(--card-background, #f5f5f5);

    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text, #333333);
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
      color: var(--text-subtitle, #666666);
      transition: all 0.2s;

      &:hover {
        background: var(--background-hover, #e0e0e0);
      }
    }
  }

  .modal-body {
    padding: 20px;

    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--card-border, #e0e0e0);
      border-radius: 8px;
      font-size: 0.95rem;
      resize: vertical;
      min-height: 100px;
      background: var(--background, #ffffff);
      color: var(--text, #333333);

      &:focus {
        outline: none;
        border-color: var(--highlight-primary, #3367d6);
        box-shadow: 0 0 0 3px rgba(51, 103, 214, 0.1);
      }
    }
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-top: 1px solid var(--card-border, #e0e0e0);
    background: var(--card-background, #f5f5f5);

    .saving-indicator {
      color: var(--highlight-primary, #3367d6);
      font-size: 0.9rem;
    }

    .error-indicator {
      color: #e74c3c;
      font-size: 0.9rem;
    }

    .footer-actions {
      display: flex;
      gap: 10px;
      margin-left: auto;
    }
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: var(--highlight-primary, #3367d6);
  color: white;

  &:hover:not(:disabled) {
    background: var(--highlight-hover, #2851a3);
  }
}

.btn-secondary {
  background: var(--card-background, #e0e0e0);
  color: var(--text, #333333);

  &:hover:not(:disabled) {
    background: var(--background-hover, #d0d0d0);
  }
}

/* Dark theme */
.dark {
  .memo-tooltip {
    background: #2b2b2b;
    border-color: #3a3a4e;
  }

  .memo-editor-modal {
    background: #1e1e2e;

    .modal-header,
    .modal-footer {
      background: #2a2a3e;
      border-color: #3a3a4e;
    }

    .modal-body textarea {
      background: #1e1e2e;
      border-color: #3a3a4e;
      color: #e0e0e0;
    }
  }

  .btn-secondary {
    background: #3a3a4e;
    color: #e0e0e0;

    &:hover:not(:disabled) {
      background: #4a4a5e;
    }
  }
}
</style>
