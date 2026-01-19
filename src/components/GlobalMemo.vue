<template>
  <div class="global-widgets-container">
    <div class="dashboard-widgets-row">
      <!-- Left: Global Memo -->
      <div class="global-memo-card widget-half">
        <div class="memo-header">
          <span class="memo-icon">📢</span>
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
      <div class="phone-validator-card widget-half">
        <iframe 
          src="/phone_validator_widget.html" 
          frameborder="0" 
          scrolling="no" 
          style="width: 100%; height: 100%;"
        ></iframe>
      </div>

      <!-- Right: Currency Converter -->
      <div class="currency-card widget-half">
        <iframe 
          src="/currency_widget.html" 
          frameborder="0" 
          scrolling="no" 
          style="width: 100%; height: 100%;"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "GlobalMemo",
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
  margin-bottom: 1.5rem;
}

.dashboard-widgets-row {
  display: flex;
  gap: 20px;
  align-items: stretch;

  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.widget-half {
  flex: 1;
  min-width: 0; /* Prevent flex item from overflowing */
  display: flex;
  flex-direction: column;
}

.global-memo-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px 20px;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  /* Ensure same height look */
  min-height: 180px; 
}

.currency-card,
.phone-validator-card {
  background: white;
  border-radius: 12px;
  overflow: hidden; /* For widget rounded corners */
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  /* Padding 0 to let widget fill */
  padding: 0; 
  position: relative;
  min-height: 180px;
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
    font-size: 1.3rem;
  }

  .memo-title {
    font-weight: 600;
    font-size: 1rem;
    flex: 1;
  }

  .edit-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
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
      color: #fff !important;
      text-decoration: underline;
      font-weight: 500;
      text-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
      
      &:hover {
        color: #a5f3fc !important;
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
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    resize: vertical;
    min-height: 80px;
    background: rgba(255, 255, 255, 0.95);
    color: #333;

    &:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
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
  border-top: 1px solid rgba(255, 255, 255, 0.2);

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
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: white;
  color: #667eea;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.9);
  }
}

/* Dark theme adjustments */
:global(.dark) .global-memo-card {
  background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

:global(.dark) .currency-card,
:global(.dark) .phone-validator-card {
  background: #2d3748; /* Dark background matching theme */
}

:global(.dark) .btn-primary {
  background: rgba(255, 255, 255, 0.9);
  color: #4a5568;
}
</style>
