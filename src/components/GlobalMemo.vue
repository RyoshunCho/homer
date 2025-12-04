<template>
  <div v-if="hasContent || isEditing" class="global-memo-container">
    <div class="global-memo-card">
      <div class="memo-header">
        <span class="memo-icon">📢</span>
        <span class="memo-title">お知らせ</span>
        <button class="edit-btn" @click="toggleEdit" :title="isEditing ? 'キャンセル' : '編集'">
          <i :class="isEditing ? 'fas fa-times' : 'fas fa-edit'"></i>
        </button>
      </div>
      
      <div v-if="!isEditing" class="memo-body">
        <p class="memo-text">{{ content }}</p>
      </div>
      
      <div v-else class="memo-edit">
        <textarea
          v-model="editContent"
          placeholder="お知らせを入力..."
          rows="3"
          ref="editTextarea"
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
.global-memo-container {
  margin-bottom: 1.5rem;
}

.global-memo-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px 20px;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
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
  .memo-text {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.6;
    white-space: pre-wrap;
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

:global(.dark) .btn-primary {
  background: rgba(255, 255, 255, 0.9);
  color: #4a5568;
}
</style>
