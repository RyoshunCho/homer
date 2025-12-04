<template>
  <Teleport to="body">
    <div v-if="isOpen" class="config-editor-overlay" @click.self="close">
      <div class="config-editor-modal">
        <div class="modal-header">
          <h2>Edit Configuration</h2>
          <button class="close-btn" @click="close" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading configuration...</p>
          </div>
          
          <div v-else-if="error" class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>{{ error }}</p>
            <button class="btn btn-secondary" @click="loadConfig">Retry</button>
          </div>
          
          <div v-else class="editor-container">
            <CodeEditor
              v-model:value="configContent"
              language="yaml"
              :theme="editorTheme"
              :options="editorOptions"
            />
          </div>
        </div>
        
        <div class="modal-footer">
          <div class="footer-info">
            <span v-if="saving" class="saving-indicator">
              <i class="fas fa-spinner fa-spin"></i> Saving...
            </span>
            <span v-else-if="saveSuccess" class="success-indicator">
              <i class="fas fa-check"></i> Saved successfully!
            </span>
          </div>
          <div class="footer-actions">
            <button class="btn btn-secondary" @click="close" :disabled="saving">
              Cancel
            </button>
            <button class="btn btn-primary" @click="save" :disabled="saving || loading">
              <i class="fas fa-save"></i> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { CodeEditor } from 'monaco-editor-vue3';

export default {
  name: "ConfigEditor",
  components: {
    CodeEditor,
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
    isDark: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close", "saved"],
  data() {
    return {
      configContent: "",
      originalContent: "",
      loading: false,
      saving: false,
      error: null,
      saveSuccess: false,
      editorOptions: {
        automaticLayout: true,
        fontSize: 14,
        lineNumbers: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
      },
    };
  },
  computed: {
    editorTheme() {
      return this.isDark ? "vs-dark" : "vs";
    },
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.loadConfig();
      }
    },
  },
  methods: {
    async loadConfig() {
      this.loading = true;
      this.error = null;
      this.saveSuccess = false;
      
      try {
        const response = await fetch("/api/config", {
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error(`Failed to load config: ${response.status}`);
        }
        
        const data = await response.json();
        this.configContent = data.content;
        this.originalContent = data.content;
      } catch (err) {
        console.error("Failed to load config:", err);
        this.error = err.message || "Failed to load configuration";
      } finally {
        this.loading = false;
      }
    },
    
    async save() {
      this.saving = true;
      this.saveSuccess = false;
      this.error = null;
      
      try {
        const response = await fetch("/api/config", {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: this.configContent }),
        });
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Failed to save: ${response.status}`);
        }
        
        this.originalContent = this.configContent;
        this.saveSuccess = true;
        this.$emit("saved");
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          this.saveSuccess = false;
        }, 3000);
      } catch (err) {
        console.error("Failed to save config:", err);
        this.error = err.message || "Failed to save configuration";
      } finally {
        this.saving = false;
      }
    },
    
    close() {
      if (this.saving) return;
      
      // Warn if there are unsaved changes
      if (this.configContent !== this.originalContent) {
        if (!confirm("You have unsaved changes. Are you sure you want to close?")) {
          return;
        }
      }
      
      this.$emit("close");
    },
  },
};
</script>

<style lang="scss" scoped>
.config-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.config-editor-modal {
  background: var(--background, #ffffff);
  border-radius: 12px;
  width: 90%;
  max-width: 1000px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--card-border, #e0e0e0);
  background: var(--card-background, #f5f5f5);
  
  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text, #333333);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    color: var(--text-subtitle, #666666);
    transition: all 0.2s;
    
    &:hover {
      background: var(--background-hover, #e0e0e0);
      color: var(--text, #333333);
    }
  }
}

.modal-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.editor-container {
  height: 100%;
  
  :deep(.monaco-editor) {
    height: 100% !important;
  }
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-subtitle, #666666);
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--card-border, #e0e0e0);
    border-top-color: var(--highlight-primary, #3367d6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  i {
    font-size: 3rem;
    color: #e74c3c;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid var(--card-border, #e0e0e0);
  background: var(--card-background, #f5f5f5);
}

.footer-info {
  .saving-indicator {
    color: var(--highlight-primary, #3367d6);
  }
  
  .success-indicator {
    color: #27ae60;
  }
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
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

// Dark theme adjustments
:global(.dark) {
  .config-editor-modal {
    background: #1e1e2e;
  }
  
  .modal-header,
  .modal-footer {
    background: #2a2a3e;
    border-color: #3a3a4e;
  }
  
  .modal-header h2,
  .btn-secondary {
    color: #e0e0e0;
  }
  
  .close-btn {
    color: #a0a0a0;
    
    &:hover {
      background: #3a3a4e;
      color: #e0e0e0;
    }
  }
  
  .btn-secondary {
    background: #3a3a4e;
    
    &:hover:not(:disabled) {
      background: #4a4a5e;
    }
  }
}
</style>
