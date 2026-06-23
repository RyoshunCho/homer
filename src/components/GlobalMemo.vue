<template>
  <div class="global-widgets-container">
    <div class="dashboard-widgets-row">
      <!-- Left: Global Memo -->
      <div class="global-memo-card widget-half">
        <div class="memo-header">
          <span class="memo-icon"><i class="fas fa-bullhorn"></i></span>
          <span class="memo-title">お知らせ|公告</span>
          <button class="edit-btn" @click="toggleEdit" :title="isEditing ? 'キャンセル' : '編集'">
            <i :class="isEditing ? 'fas fa-times' : 'fas fa-edit'"></i>
          </button>
        </div>
        
        <div v-if="!isEditing" class="memo-body">
          <p v-if="hasContent" class="memo-text" v-html="linkedContent"></p>
          <p v-else class="memo-placeholder">お知らせはありません。編集ボタンで追加できます。</p>
        </div>
        
        <div v-else class="memo-edit">
          <textarea
            v-model="editContent"
            placeholder="お知らせを入力..."
            rows="3"
            ref="editTextarea"
            @keydown.stop
          ></textarea>
          <div class="edit-actions">
            <span v-if="saving" class="saving-indicator">
              <i class="fas fa-spinner fa-spin"></i> 保存中...
            </span>
            <span v-if="error" class="error-indicator">{{ error }}</span>
            <button class="btn btn-primary" @click="save" :disabled="saving">
              <i class="fas fa-save"></i> 保存
            </button>
          </div>
        </div>
        
        <div v-if="updatedBy && !isEditing" class="memo-footer">
          <span class="update-info">
            最終更新: {{ formattedDate }} by {{ updatedBy }}
          </span>
        </div>
      </div>
      
      <!-- Middle: Phone Validator -->
      <PhoneValidatorWidget class="widget-half phone-validator-card" />

      <!-- Right: Currency Converter -->
      <div class="currency-card widget-half">
        <iframe 
          src="/currency_widget.html" 
          frameborder="0" 
          scrolling="no" 
          style="width: 100%; height: 100%; flex: 1; min-height: 240px; border: none;"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script>
import PhoneValidatorWidget from './PhoneValidatorWidget.vue';

export default {
  name: "GlobalMemo",
  components: {
    PhoneValidatorWidget
  },
  props: {
    globalMemo: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ["saved"],
  data() {
    return {
      isEditing: false,
      editContent: "",
      saving: false,
      error: null,
    };
  },
  computed: {
    content() {
      return this.globalMemo?.content || "";
    },
    updatedAt() {
      return this.globalMemo?.updatedAt || "";
    },
    updatedBy() {
      return this.globalMemo?.updatedBy || "";
    },
    hasContent() {
      return this.content.trim().length > 0;
    },
    formattedDate() {
      if (!this.updatedAt) return "";
      try {
        const date = new Date(this.updatedAt);
        return date.toLocaleString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return this.updatedAt;
      }
    },
    linkedContent() {
      if (!this.content) return "";
      // Convert URLs to clickable links
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      const escaped = this.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");
      return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
    },
  },
  methods: {
    toggleEdit() {
      if (this.isEditing) {
        this.isEditing = false;
        this.editContent = "";
        this.error = null;
      } else {
        this.editContent = this.content;
        this.isEditing = true;
        this.$nextTick(() => {
          this.$refs.editTextarea?.focus();
        });
      }
    },
    async save() {
      this.saving = true;
      this.error = null;

      try {
        const response = await fetch("/api/config/global-memo", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: this.editContent,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Failed: ${response.status}`);
        }

        const result = await response.json();
        
        // Update parent
        this.$emit("saved", {
          content: this.editContent,
          updatedAt: result.updatedAt,
          updatedBy: result.updatedBy,
        });
        
        this.isEditing = false;
      } catch (err) {
        console.error("Global memo save failed:", err);
        this.error = err.message || "保存に失敗しました";
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.global-widgets-container {
  margin-bottom: 1.75rem;
}

.dashboard-widgets-row {
  display: flex;
  gap: 20px;
  align-items: stretch; /* Critical for equal height */

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: normal; /* Reset on mobile */
  }
}

.widget-half {
  flex: 1;
  min-width: 0; 
  display: flex;
  flex-direction: column;
  /* Ensure it fills height if simplified flex behavior fails */
  align-self: stretch; 
}

.global-memo-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.09), transparent 52%),
    var(--card-background);
  border: 1px solid var(--surface-border);
  border-radius: 1.1rem;
  padding: 16px 20px;
  color: var(--text);
  box-shadow: 0 18px 52px -42px var(--card-shadow);
}

.currency-card {
  background: var(--card-background);
  border: 1px solid var(--surface-border);
  border-radius: 1.1rem;
  overflow: hidden; 
  box-shadow: 0 18px 52px -42px var(--card-shadow);
  padding: 0; 
  position: relative;
  display: flex; 
  flex-direction: column;
  min-height: 220px;
}

.phone-validator-card {
  background: var(--card-background);
  border: 1px solid var(--surface-border);
  border-radius: 1.1rem;
  /* overflow: hidden; */ /* Allow shadows/content to flow if needed, but usually hidden is safer for radii */
  overflow: hidden;
  box-shadow: 0 18px 52px -42px var(--card-shadow);
  /* padding: 0; REMOVED to allow component padding */
  position: relative;
  display: flex; 
  flex-direction: column;
}

.tradingview-widget-container {
  width: 100%;
  height: 100%;
}

.memo-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  .memo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 999px;
    color: var(--highlight-primary);
    background: var(--surface-soft);
  }

  .memo-title {
    font-weight: 600;
    font-size: 1rem;
    flex: 1;
    color: var(--text-title);
  }

  .edit-btn {
    background: var(--surface-soft);
    border: none;
    color: var(--text-title);
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    transition:
      background-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
      transform 260ms cubic-bezier(0.16, 1, 0.3, 1);

    &:hover {
      background: color-mix(in srgb, var(--highlight-primary) 18%, transparent);
    }

    &:active {
      transform: translateY(1px) scale(0.98);
    }
  }
}

.memo-body {
  flex: 1; /* Fill vertical space */
  display: flex;
  flex-direction: column;

  .memo-text {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.6;

    :deep(a) {
      color: var(--link) !important;
      text-decoration: underline;
      font-weight: 500;
      text-shadow: none;
      
      &:hover {
        color: var(--link-hover) !important;
      }
    }
  }

  .memo-placeholder {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.7;
    font-style: italic;
  }
}

.memo-edit {
  textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--surface-border);
    border-radius: 14px;
    font-size: 0.95rem;
    resize: vertical;
    min-height: 80px;
    background: var(--input-background);
    color: var(--text);

    &:focus {
      outline: none;
      box-shadow: 0 0 0 4px var(--focus-ring);
    }
  }

  .edit-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 10px;

    .saving-indicator {
      font-size: 0.85rem;
      opacity: 0.9;
    }

    .error-indicator {
      font-size: 0.85rem;
      color: #ffcccc;
    }
  }
}

.memo-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);

  .update-info {
    font-size: 0.8rem;
    opacity: 0.8;
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 999px;
  font-size: 0.85rem;
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
  background: var(--highlight-primary);
  color: var(--text-header);

  &:hover:not(:disabled) {
    background: var(--highlight-hover);
  }
}

/* Dark theme adjustments */
:global(.dark) .currency-card,
:global(.dark) .phone-validator-card {
  background: var(--card-background);
}

:global(.dark) .btn-primary {
  background: var(--highlight-primary);
  color: var(--text-header);
}
</style>
