<template>
  <div class="phone-widget-container">
    <div class="widget-header">Phone No. Formatter</div>

    <div class="input-group">
      <input 
        type="tel" 
        v-model="rawInput" 
        @keypress.enter="formatPhoneNumber"
        class="phone-input" 
        placeholder="+1 555 0123" 
        autocomplete="tel"
      >
      <button @click="formatPhoneNumber" class="action-btn" :disabled="isLoading">
        {{ isLoading ? 'Checking' : 'Check' }}
      </button>
    </div>

    <div v-if="hasResult" class="result-card visible">
      <div class="formatted-number">{{ displayedFormatted }}</div>
      
      <div class="result-row">
        <span class="label">Country</span>
        <div class="value">
          <img v-if="displayedCountry" class="flag-icon" :src="flagUrl" alt="flag">
          <span>{{ displayedCountryName }}</span>
        </div>
      </div>

      <div v-if="displayedLocation" class="result-row">
        <span class="label">Location</span>
        <span class="value">{{ displayedLocation }}</span>
      </div>

      <div class="result-row">
        <span class="label">Primary Language</span>
        <span class="value">{{ displayedLanguage }}</span>
      </div>

      <div class="result-row">
        <span class="label">Type</span>
        <span class="value">{{ displayedType }}</span>
      </div>

      <div class="result-row">
        <span class="label">Local Format</span>
        <span class="value">{{ displayedLocalFormat }}</span>
      </div>

      <div v-if="candidates.length > 1" class="result-row alternatives-container">
        <span class="label" style="width: 100%">Alternatives:</span>
        <button 
          v-for="(cand, idx) in candidates" 
          :key="idx" 
          v-show="idx !== currentCandidateIndex"
          class="status-badge alt-btn"
          @click="selectCandidate(idx)"
        >
          <img v-if="cand.country" class="flag-icon-sm" :src="`https://flagcdn.com/w40/${cand.country.toLowerCase()}.png`" />
          <span>{{ cand.country || '?' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
const PHONE_API_BASE_URL = 'https://phone-api.lodgegeek.com';
const PRIORITY_COUNTRIES = ['JP', 'CN', 'HK', 'TW', 'KR', 'US'];

export default {
  name: 'PhoneValidatorWidget',
  data() {
    return {
      rawInput: '',
      candidates: [],
      currentCandidateIndex: 0,
      hasResult: false,
      isLoading: false,
      errorMessage: ''
    };
  },
  computed: {
    currentCandidate() {
      if (this.candidates.length === 0) return null;
      return this.candidates[this.currentCandidateIndex] || null;
    },
    flagUrl() {
      const country = this.displayedCountry;
      if (!country) return '';
      return `https://flagcdn.com/w40/${country.toLowerCase()}.png`;
    },
    displayedFormatted() {
      if (this.errorMessage) return this.errorMessage;
      if (!this.currentCandidate) return this.rawInput;
      return this.currentCandidate.international || this.currentCandidate.e164 || this.rawInput;
    },
    displayedLocalFormat() {
      return this.currentCandidate ? (this.currentCandidate.national || '-') : '-';
    },
    displayedCountry() {
      return this.currentCandidate ? this.currentCandidate.country : null;
    },
    displayedCountryName() {
      if (!this.currentCandidate) return this.errorMessage ? '-' : 'Unknown Region';
      return this.currentCandidate.countryName || this.currentCandidate.country || 'Unknown Region';
    },
    displayedLocation() {
      return this.currentCandidate ? this.currentCandidate.location || null : null;
    },
    displayedLanguage() {
      return this.currentCandidate ? this.currentCandidate.language || '-' : '-';
    },
    displayedType() {
      return this.currentCandidate ? this.currentCandidate.typeLabel || 'Unknown' : '-';
    }
  },
  methods: {
    async formatPhoneNumber() {
      const raw = this.rawInput.trim();
      if (!raw) {
        this.hasResult = false;
        this.errorMessage = '';
        this.candidates = [];
        return;
      }

      this.isLoading = true;
      this.errorMessage = '';
      this.currentCandidateIndex = 0;

      try {
        const response = await fetch(`${PHONE_API_BASE_URL}/v1/format`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: raw,
            defaultCountries: PRIORITY_COUNTRIES,
            locale: 'en'
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          throw new Error(body.error?.message || 'Phone lookup failed');
        }

        this.candidates = Array.isArray(body.candidates) ? body.candidates : [];
        this.hasResult = true;
        if (this.candidates.length === 0) {
          this.errorMessage = 'No valid phone number found';
        }
      } catch (error) {
        console.error(error);
        this.candidates = [];
        this.errorMessage = 'Phone lookup failed';
        this.hasResult = true;
      } finally {
        this.isLoading = false;
      }
    },
    selectCandidate(idx) {
      this.currentCandidateIndex = idx;
    }
  }
}
</script>

<style scoped>
.phone-widget-container {
  width: 100%;
  padding: 24px;
  box-sizing: border-box;
  font-family: inherit;
  color: var(--text);
  display: flex;
  flex-direction: column;
  background-color: transparent; /* Parent controls BG */
  flex: 1; /* Key to stretching inside parental flex item */
}

.widget-header {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text-title);
  letter-spacing: -0.02em;
}

.input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.phone-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 0.95rem;
  outline: none;
  background: var(--input-background);
  color: var(--text);
  transition:
    border-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.phone-input:focus {
  border-color: var(--highlight-primary);
  background: var(--card-background);
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.action-btn {
  background: var(--highlight-primary);
  color: var(--text-header);
  border: none;
  border-radius: 999px;
  padding: 0 20px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 14px 36px -24px var(--highlight-primary);
}

.action-btn:hover {
  background: var(--highlight-hover);
}

.action-btn:active {
  transform: translateY(1px) scale(0.98);
}

.result-card {
  background: transparent;
  border-radius: 14px;
  padding: 8px 0; /* Less padding, integrate into flow */
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: fadeIn 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.formatted-number {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-title);
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  padding: 4px 0;
  border-bottom: 1px solid var(--surface-border);
}

.result-row:last-child {
  border-bottom: none;
}

.alternatives-container {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--surface-border);
}

.label {
  color: var(--text-subtitle);
  font-weight: 500;
  min-width: 100px;
}

.value {
  font-weight: 600;
  color: var(--text-title);
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: right;
}

.flag-icon {
  width: 20px;
  height: auto;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.flag-icon-sm {
  width: 16px;
  height: 12px;
  border-radius: 2px;
  object-fit: cover;
}

.status-badge {
  font-size: 0.8rem;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
  border: 1px solid var(--surface-border);
  background: var(--surface-elevated);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition:
    background-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 260ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  color: var(--text);
}

.status-badge:hover {
  background: var(--surface-soft);
  border-color: var(--highlight-primary);
  transform: translateY(-1px);
}

/* Dark mode overrides via global class check */
:global(.dark) .phone-widget-container {
  color: #e8eaed;
}

:global(.dark) .phone-input {
  background: var(--input-background);
  color: #e8eaed;
  border-color: var(--surface-border);
}

:global(.dark) .phone-input:focus {
  border-color: var(--highlight-primary);
}

:global(.dark) .widget-header {
  color: #fff;
}

:global(.dark) .result-card {
  background: transparent;
  border: none;
}

:global(.dark) .label {
  color: #a0aec0;
}

:global(.dark) .value {
  color: #f7fafc;
}

:global(.dark) .formatted-number {
  color: #fff;
}

:global(.dark) .result-row {
  border-color: rgba(255,255,255,0.05);
}

:global(.dark) .alternatives-container {
  border-color: rgba(255,255,255,0.1);
}

:global(.dark) .status-badge {
  background: rgba(255,255,255,0.05);
  color: #e2e8f0;
  border-color: rgba(255,255,255,0.1);
}
:global(.dark) .status-badge:hover {
  background: rgba(255,255,255,0.1);
}
</style>
