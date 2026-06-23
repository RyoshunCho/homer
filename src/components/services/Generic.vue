<template>
  <div>
    <div class="card" :class="{ 'is-disabled': item.disabled }" :style="`background-color:${item.background};`">
      <div v-if="hasAnyExtra" class="doc-link" @click.stop>
        <span
          class="memo-icon"
          :class="{ 'has-memo': item.memo }"
          @click="openMemoEditor"
          @mouseenter="showMemoTooltip"
          @mouseleave="hideMemoTooltip"
          title="Memo"
        ><i class="fas fa-note-sticky"></i></span>
        <a
          v-if="item.doc"
          :href="item.doc"
          target="_blank"
          rel="noreferrer"
          title="Documentation"
        ><i class="fas fa-book-open"></i></a>
        <a
          v-if="item.video"
          :href="item.video"
          target="_blank"
          rel="noreferrer"
          title="Video"
        ><i class="fas fa-circle-play"></i></a>
      </div>
      <a :href="item.url" :target="item.target || '_blank'" rel="noreferrer">
        <div class="card-content">
          <div :class="mediaClass">
            <slot name="icon">
              <div v-if="item.logo" class="media-left">
                <figure class="image is-48x48">
                  <img
                    :src="item.logo"
                    :alt="`${item.name} logo`"
                    @error="$event.target.classList.add('is-broken-logo')"
                  />
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

      <!-- Memo Modal (View / Edit) -->
      <div v-if="showMemoModal" class="memo-editor-overlay" @click.self="closeMemoModal">
        <div class="memo-editor-modal">
          <div class="modal-header">
            <h3><i class="fas fa-note-sticky"></i> {{ item.name }} - Memo</h3>
            <button class="close-btn" @click="closeMemoModal" title="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- View Mode -->
          <div v-if="!isEditing" class="modal-body view-mode">
            <div v-if="item.memo" class="memo-content-view" v-html="linkedMemo"></div>
            <div v-else class="memo-empty">メモはありません</div>
            <div class="view-footer">
              <div v-if="item.memoUpdatedBy || item.memoUpdatedAt" class="memo-metadata">
                <span v-if="item.memoUpdatedBy" class="memo-author">{{ item.memoUpdatedBy }}</span>
                <span v-if="item.memoUpdatedAt" class="memo-date">{{ formattedMemoDate }}</span>
              </div>
              <div class="view-actions">
                <button class="btn btn-primary" @click="startEdit">
                  <i class="fas fa-edit"></i> 編集
                </button>
              </div>
            </div>
          </div>
          
          <!-- Edit Mode -->
          <div v-else class="modal-body">
            <textarea
              v-model="editContent"
              placeholder="メモを入力..."
              rows="5"
              ref="memoTextarea"
              @keydown.stop
            ></textarea>
          </div>
          <div v-if="isEditing" class="modal-footer">
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
      showMemoModal: false,
      isEditing: false,
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
      return this.item.name || this.item.memo || this.item.doc || this.item.video;
    },
    tooltipStyle: function () {
      return {
        left: `${this.tooltipX}px`,
        top: `${this.tooltipY}px`,
      };
    },
    linkedMemo: function () {
      if (!this.item.memo) return "";
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      const escaped = this.item.memo
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");
      return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
    },
    formattedMemoDate: function () {
      if (!this.item.memoUpdatedAt) return "";
      try {
        const date = new Date(this.item.memoUpdatedAt);
        return date.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        return this.item.memoUpdatedAt;
      }
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
      this.showMemoModal = true;
      this.isEditing = false;
      this.saveError = null;
    },
    startEdit() {
      this.editContent = this.item.memo || "";
      this.isEditing = true;
      this.$nextTick(() => {
        this.$refs.memoTextarea?.focus();
      });
    },
    closeMemoModal() {
      if (this.saving) return;
      this.showMemoModal = false;
      this.isEditing = false;
      this.editContent = "";
      this.saveError = null;
    },
    cancelEdit() {
      if (this.saving) return;
      this.isEditing = false;
      this.editContent = "";
      this.saveError = null;
    },
    async saveMemo() {
      if (!this.item.name) {
        this.saveError = "サービス名がありません";
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
            serviceName: this.item.name,
            memo: this.editContent,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Failed: ${response.status}`);
        }

        const result = await response.json();

        // Update local item with new values
        this.item.memo = this.editContent;
        if (result.memoUpdatedBy) {
          this.item.memoUpdatedBy = result.memoUpdatedBy;
        }
        if (result.memoUpdatedAt) {
          this.item.memoUpdatedAt = result.memoUpdatedAt;
        }
        this.isEditing = false;
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
  display: flex;
  gap: 0.35rem;
  font-size: 0.9rem;

  a, .memo-icon {
    text-decoration: none;
    transition:
      transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
      background-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity 260ms cubic-bezier(0.16, 1, 0.3, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.65rem;
    height: 1.65rem;
    border: 1px solid var(--surface-border, rgba(0, 0, 0, 0.1));
    border-radius: 999px;
    background: var(--surface-elevated, rgba(255, 255, 255, 0.82));
    cursor: pointer;

    &:hover {
      background: var(--surface-soft, rgba(51, 103, 214, 0.08));
      transform: translateY(-1px) scale(1.04);
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

    &.is-broken-logo {
      opacity: 0;
    }
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

.card.is-disabled {
  opacity: 0.5;
  filter: grayscale(50%);
  
  &::after {
    content: "準備中";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
  }
}
</style>

<style lang="scss">
/* Non-scoped styles for Teleported content */
.memo-tooltip {
  position: fixed;
  max-width: 300px;
  padding: 12px 14px;
  background: var(--surface-elevated, #ffffff);
  border: 1px solid var(--surface-border, #e0e0e0);
  border-radius: 14px;
  box-shadow: 0 24px 70px -42px var(--card-shadow, rgba(0, 0, 0, 0.25));
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
  background: rgba(10, 14, 22, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20001;
  backdrop-filter: blur(12px);
}

.memo-editor-modal {
  background: var(--surface-elevated, #ffffff);
  border: 1px solid var(--surface-border, #e0e0e0);
  border-radius: 22px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 30px 90px -40px var(--card-shadow, rgba(0, 0, 0, 0.3));
  overflow: hidden;

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
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
      border-radius: 999px;
      color: var(--text-subtitle, #666666);
      transition:
        background-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
        transform 260ms cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: var(--surface-soft, #e0e0e0);
        transform: scale(0.96);
      }
    }
  }

  .modal-body {
    padding: 20px;

    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--surface-border, #e0e0e0);
      border-radius: 14px;
      font-size: 0.95rem;
      resize: vertical;
      min-height: 100px;
      background: var(--background, #ffffff);
      color: var(--text, #333333);

      &:focus {
        outline: none;
        border-color: var(--highlight-primary, #3367d6);
        box-shadow: 0 0 0 4px var(--focus-ring, rgba(51, 103, 214, 0.1));
      }
    }

    &.view-mode {
      .memo-content-view {
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.6;
        color: var(--text, #333333);
        
        a {
          color: var(--link, #3273dc);
          text-decoration: underline;
          
          &:hover {
            color: var(--link-hover, #1a4a9e);
          }
        }
      }

      .memo-empty {
        color: var(--text-subtitle, #666666);
        font-style: italic;
      }

      .view-footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-top: 16px;
        gap: 12px;
      }

      .memo-metadata {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.75rem;
        color: var(--text-subtitle, #888888);

        .memo-author {
          opacity: 0.9;
        }

        .memo-date {
          opacity: 0.7;
        }
      }

      .view-actions {
        text-align: right;
        flex-shrink: 0;
      }
    }
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-top: 1px solid var(--surface-border, #e0e0e0);
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
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:active:not(:disabled) {
    transform: translateY(1px) scale(0.98);
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
