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
      <button @click="formatPhoneNumber" class="action-btn">Check</button>
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
export default {
  name: 'PhoneValidatorWidget',
  data() {
    return {
      rawInput: '',
      libphonenumber: null,
      candidates: [],
      currentCandidateIndex: 0,
      hasResult: false,
      priorityCountries: ['JP', 'CN', 'HK', 'TW', 'KR', 'US'],
      
      // Data Maps
      countryNames: null,
      countryLanguages: {
        'CN': 'Chinese (简体中文)',
        'TW': 'Chinese (繁體中文)',
        'JP': 'Japanese (日本語)',
        'US': 'English',
        'GB': 'English',
        'AU': 'English',
        'CA': 'English / French',
        'KR': 'Korean (한국어)',
        'FR': 'French',
        'DE': 'German',
        'IT': 'Italian',
        'ES': 'Spanish',
        'BR': 'Portuguese',
        'RU': 'Russian',
        'IN': 'Hindi / English',
        'TH': 'Thai',
        'VN': 'Vietnamese',
        'MY': 'Malay',
        'SG': 'English / Malay / Chinese',
        'ID': 'Indonesian',
        'PH': 'Filipino / English',
        'HK': 'Chinese (Cantonese)',
      },
      cnAreaCodes: {
        '10': 'Beijing (北京)', '20': 'Guangzhou (广州)', '21': 'Shanghai (上海)',
        '22': 'Tianjin (天津)', '23': 'Chongqing (重庆)', '24': 'Shenyang (沈阳)',
        '25': 'Nanjing (南京)', '27': 'Wuhan (武汉)', '28': 'Chengdu (成都)', '29': 'Xi\'an (西安)',
        '755': 'Shenzhen (深圳)', '757': 'Foshan (佛山)', '769': 'Dongguan (东莞)',
        '571': 'Hangzhou (杭州)', '512': 'Suzhou (苏州)', '532': 'Qingdao (青岛)',
        '592': 'Xiamen (厦门)', '411': 'Dalian (大连)', '574': 'Ningbo (宁波)'
      },
      cnCarriers: {
        '134': 'China Mobile', '135': 'China Mobile', '136': 'China Mobile', '137': 'China Mobile',
        '138': 'China Mobile', '139': 'China Mobile', '147': 'China Mobile', '150': 'China Mobile',
        '151': 'China Mobile', '152': 'China Mobile', '157': 'China Mobile', '158': 'China Mobile',
        '159': 'China Mobile', '172': 'China Mobile', '178': 'China Mobile', '182': 'China Mobile',
        '183': 'China Mobile', '184': 'China Mobile', '187': 'China Mobile', '188': 'China Mobile',
        '195': 'China Mobile', '197': 'China Mobile', '198': 'China Mobile',
        '130': 'China Unicom', '131': 'China Unicom', '132': 'China Unicom', '145': 'China Unicom',
        '155': 'China Unicom', '156': 'China Unicom', '166': 'China Unicom', '175': 'China Unicom',
        '176': 'China Unicom', '185': 'China Unicom', '186': 'China Unicom', '196': 'China Unicom',
        '133': 'China Telecom', '149': 'China Telecom', '153': 'China Telecom', '173': 'China Telecom',
        '177': 'China Telecom', '180': 'China Telecom', '181': 'China Telecom', '189': 'China Telecom',
        '190': 'China Telecom', '191': 'China Telecom', '193': 'China Telecom', '199': 'China Telecom'
      },
      cnHcodeMap: {
        '1503358': 'Hebei Qinhuangdao (河北 秦皇岛)',
        '1391000': 'Beijing (北京)', '1380013': 'Beijing (北京)',
        '1390162': 'Shanghai (上海)',
      },
      usAreaCodes: {
        '201': 'New Jersey', '202': 'District of Columbia', '203': 'Connecticut', '205': 'Alabama',
        '206': 'Washington', '207': 'Maine', '208': 'Idaho', '209': 'California',
        '210': 'Texas', '212': 'New York', '213': 'California', '214': 'Texas',
        '215': 'Pennsylvania', '216': 'Ohio', '217': 'Illinois', '218': 'Minnesota',
        '219': 'Indiana', '220': 'Ohio', '224': 'Illinois', '225': 'Louisiana',
        '228': 'Mississippi', '229': 'Georgia', '231': 'Michigan', '234': 'Ohio',
        '239': 'Florida', '240': 'Maryland', '248': 'Michigan', '251': 'Alabama',
        '252': 'North Carolina', '253': 'Washington', '254': 'Texas', '256': 'Alabama',
        '260': 'Indiana', '262': 'Wisconsin', '267': 'Pennsylvania', '269': 'Michigan',
        '270': 'Kentucky', '272': 'Pennsylvania', '276': 'Virginia', '281': 'Texas',
        '301': 'Maryland', '302': 'Delaware', '303': 'Colorado', '304': 'West Virginia',
        '305': 'Florida', '307': 'Wyoming', '308': 'Nebraska', '309': 'Illinois',
        '310': 'California', '312': 'Illinois', '313': 'Michigan', '314': 'Missouri',
        '315': 'New York', '316': 'Kansas', '317': 'Indiana', '318': 'Louisiana',
        '319': 'Iowa', '320': 'Minnesota', '321': 'Florida', '323': 'California',
        '325': 'Texas', '330': 'Ohio', '331': 'Illinois', '334': 'Alabama',
        '336': 'North Carolina', '337': 'Louisiana', '339': 'Massachusetts', '340': 'Virgin Islands',
        '346': 'Texas', '347': 'New York', '351': 'Massachusetts', '352': 'Florida',
        '360': 'Washington', '361': 'Texas', '364': 'Kentucky', '380': 'Ohio',
        '385': 'Utah', '386': 'Florida', '401': 'Rhode Island', '402': 'Nebraska',
        '404': 'Georgia', '405': 'Oklahoma', '406': 'Montana', '407': 'Florida',
        '408': 'California', '409': 'Texas', '410': 'Maryland', '412': 'Pennsylvania',
        '413': 'Massachusetts', '414': 'Wisconsin', '415': 'California', '417': 'Missouri',
        '419': 'Ohio', '423': 'Tennessee', '424': 'California', '425': 'Washington',
        '430': 'Texas', '432': 'Texas', '434': 'Virginia', '435': 'Utah',
        '440': 'Ohio', '442': 'California', '443': 'Maryland', '458': 'Oregon',
        '469': 'Texas', '470': 'Georgia', '475': 'Connecticut', '478': 'Georgia',
        '479': 'Arkansas', '480': 'Arizona', '484': 'Pennsylvania', '501': 'Arkansas',
        '502': 'Kentucky', '503': 'Oregon', '504': 'Louisiana', '505': 'New Mexico',
        '507': 'Minnesota', '508': 'Massachusetts', '509': 'Washington', '510': 'California',
        '512': 'Texas', '513': 'Ohio', '515': 'Iowa', '516': 'New York',
        '517': 'Michigan', '518': 'New York', '520': 'Arizona', '530': 'California',
        '531': 'Nebraska', '534': 'Wisconsin', '539': 'Oklahoma', '540': 'Virginia',
        '541': 'Oregon', '551': 'New Jersey', '559': 'California', '561': 'Florida',
        '562': 'California', '563': 'Iowa', '567': 'Ohio', '570': 'Pennsylvania',
        '571': 'Virginia', '573': 'Missouri', '574': 'Indiana', '575': 'New Mexico',
        '580': 'Oklahoma', '585': 'New York', '586': 'Michigan', '601': 'Mississippi',
        '602': 'Arizona', '603': 'New Hampshire', '605': 'South Dakota', '606': 'Kentucky',
        '607': 'New York', '608': 'Wisconsin', '609': 'New Jersey', '610': 'Pennsylvania',
        '612': 'Minnesota', '614': 'Ohio', '615': 'Tennessee', '616': 'Michigan',
        '617': 'Massachusetts', '618': 'Illinois', '619': 'California', '620': 'Kansas',
        '623': 'Arizona', '626': 'California', '628': 'California', '630': 'Illinois',
        '631': 'New York', '636': 'Missouri', '641': 'Iowa', '646': 'New York',
        '650': 'California', '651': 'Minnesota', '657': 'California', '660': 'Missouri',
        '661': 'California', '662': 'Mississippi', '667': 'Maryland', '669': 'California',
        '670': 'Northern Mariana Islands', '671': 'Guam', '678': 'Georgia', '681': 'West Virginia',
        '682': 'Texas', '684': 'American Samoa', '701': 'North Dakota', '702': 'Nevada',
        '703': 'Virginia', '704': 'North Carolina', '706': 'Georgia', '707': 'California',
        '708': 'Illinois', '712': 'Iowa', '713': 'Texas', '714': 'California',
        '715': 'Wisconsin', '716': 'New York', '717': 'Pennsylvania', '718': 'New York',
        '719': 'Colorado', '720': 'Colorado', '724': 'Pennsylvania', '725': 'Nevada',
        '727': 'Florida', '731': 'Tennessee', '732': 'New Jersey', '734': 'Michigan',
        '737': 'Texas', '740': 'Ohio', '747': 'California', '754': 'Florida',
        '757': 'Virginia', '760': 'California', '762': 'Georgia', '763': 'Minnesota',
        '765': 'Indiana', '769': 'Mississippi', '770': 'Georgia', '772': 'Florida',
        '773': 'Illinois', '774': 'Massachusetts', '775': 'Nevada', '779': 'Illinois',
        '781': 'Massachusetts', '785': 'Kansas', '786': 'Florida', '787': 'Puerto Rico',
        '801': 'Utah', '802': 'Vermont', '803': 'South Carolina', '804': 'Virginia',
        '805': 'California', '806': 'Texas', '808': 'Hawaii', '810': 'Michigan',
        '812': 'Indiana', '813': 'Florida', '814': 'Pennsylvania', '815': 'Illinois',
        '816': 'Missouri', '817': 'Texas', '818': 'California', '828': 'North Carolina',
        '830': 'Texas', '831': 'California', '832': 'Texas', '843': 'South Carolina',
        '845': 'New York', '847': 'Illinois', '848': 'New Jersey', '850': 'Florida',
        '856': 'New Jersey', '857': 'Massachusetts', '858': 'California', '859': 'Kentucky',
        '860': 'Connecticut', '862': 'New Jersey', '863': 'Florida', '864': 'South Carolina',
        '865': 'Tennessee', '870': 'Arkansas', '872': 'Illinois', '878': 'Pennsylvania',
        '901': 'Tennessee', '903': 'Texas', '904': 'Florida', '906': 'Michigan',
        '907': 'Alaska', '908': 'New Jersey', '909': 'California', '910': 'North Carolina',
        '912': 'Georgia', '913': 'Kansas', '914': 'New York', '915': 'Texas',
        '916': 'California', '917': 'New York', '918': 'Oklahoma', '919': 'North Carolina',
        '920': 'Wisconsin', '925': 'California', '928': 'Arizona', '929': 'New York',
        '931': 'Tennessee', '936': 'Texas', '937': 'Ohio', '938': 'Alabama',
        '939': 'Puerto Rico', '940': 'Texas', '941': 'Florida', '947': 'Michigan',
        '949': 'California', '951': 'California', '952': 'Minnesota', '954': 'Florida',
        '956': 'Texas', '959': 'Connecticut', '970': 'Colorado', '971': 'Oregon',
        '972': 'Texas', '973': 'New Jersey', '978': 'Massachusetts', '979': 'Texas',
        '980': 'North Carolina', '984': 'North Carolina', '985': 'Louisiana', '989': 'Michigan'
      }
    };
  },
  computed: {
    currentCandidate() {
      if (this.candidates.length === 0) return null;
      return this.candidates[this.currentCandidateIndex];
    },
    flagUrl() {
      const country = this.displayedCountry;
      if (!country) return '';
      return `https://flagcdn.com/w40/${country.toLowerCase()}.png`;
    },
    displayedFormatted() {
      if (!this.currentCandidate) return this.rawInput;
      const pn = this.currentCandidate;
      // If we added '+' manually, we might want to respect that logic, but using formatInternational is usually safe.
      // However, if the user input was without +, we might want to show what we parsed.
      return pn.formatInternational() || pn.number;
    },
    displayedLocalFormat() {
      return this.currentCandidate ? (this.currentCandidate.formatNational() || '-') : '-';
    },
    displayedCountry() {
      return this.currentCandidate ? this.currentCandidate.country : null;
    },
    displayedCountryName() {
      const c = this.displayedCountry;
      if (!c) return 'Unknown Region';
      try {
        if (this.countryNames) return this.countryNames.of(c);
      } catch (e) {
        // ignore
      }
      return c;
    },
    displayedLocation() {
      if (!this.currentCandidate) return null;
      return this.getRegionInfo(this.currentCandidate);
    },
    displayedLanguage() {
      const c = this.displayedCountry;
      return this.countryLanguages[c] || (c ? 'Unknown' : '-');
    },
    displayedType() {
      if (!this.currentCandidate) return '-';
      const t = this.currentCandidate.getType();
      if (!t) return 'Unknown';
      return t.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
  },
  mounted() {
    this.countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
    this.loadLibrary();
  },
  methods: {
    async loadLibrary() {
      if (window.libphonenumber) {
        this.libphonenumber = window.libphonenumber;
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/libphonenumber-js@1.10.49/bundle/libphonenumber-max.js';
      script.onload = () => {
        this.libphonenumber = window.libphonenumber;
      };
      document.head.appendChild(script);
    },
    formatPhoneNumber() {
      if (!this.libphonenumber) return;
      
      let raw = this.rawInput.trim();
      if (!raw) {
        this.hasResult = false;
        return;
      }

      this.candidates = [];
      this.currentCandidateIndex = 0;
      const seen = new Set();
      const lib = this.libphonenumber;

      const addCandidate = (pn) => {
        if (pn && pn.isValid()) {
          const key = `${pn.country}-${pn.number}`;
          if (!seen.has(key)) {
            this.candidates.push(pn);
            seen.add(key);
          }
        }
      };

      // 1. Strict
      try { addCandidate(lib.parsePhoneNumber(raw)); } catch(e) {}

      // 2. Prepend +
      if (!raw.startsWith('+')) {
        try { addCandidate(lib.parsePhoneNumber('+' + raw)); } catch(e) {}
      }

      // 3. Priority countries
      for (const c of this.priorityCountries) {
        try { addCandidate(lib.parsePhoneNumber(raw, c)); } catch(e) {}
      }

      // 4. Fallback (clean and +)
      if (this.candidates.length === 0) {
        // Try loose fallback just to show raw info
        let fallback = null;
        try { fallback = lib.parsePhoneNumber(raw); } catch(e){}
        if (!fallback && !raw.startsWith('+')) {
          try { fallback = lib.parsePhoneNumber('+' + raw); } catch(e){}
        }
        
        // If still nothing, maybe just invalid object wrapper
        // But for Vue binding, it is easier to show error state if empty
        if (fallback) {
           // It's invalid but parsed
           this.candidates = [fallback];
        } else {
           // We will just show custom "raw" view or handle it in template via checks
           // For simplicity, if candidates empty, we show raw info in displayedFormatted via 'v-else' logic or similar.
           // actually displayedFormatted falls back to rawInput if currentCandidate is null.
           // We just set hasResult = true.
        }
      }

      this.hasResult = true;
    },
    selectCandidate(idx) {
      this.currentCandidateIndex = idx;
    },
    getRegionInfo(pn) {
        const country = pn.country;
        const national = pn.nationalNumber;
        if (!national) return null;

        if (country === 'US') {
            const areaCode = national.substring(0, 3);
            return this.usAreaCodes[areaCode] || null;
        }

        if (country === 'CN') {
            const ac2 = national.substring(0, 2);
            if (this.cnAreaCodes[ac2]) return this.cnAreaCodes[ac2];
            const ac3 = national.substring(0, 3);
            if (this.cnAreaCodes[ac3]) return this.cnAreaCodes[ac3];

            const prefix = national.substring(0, 3);
            const hcode = national.substring(0, 7);
            
            let carrier = this.cnCarriers[prefix] || '';
            let location = this.cnHcodeMap[hcode] || '';
            
            if (location && carrier) return `${location} - ${carrier}`;
            if (location) return location;
            if (carrier) return `China (${carrier})`;
        }
        return null;
    }
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

.phone-widget-container {
  width: 100%;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  font-family: 'Inter', sans-serif;
  color: #333;
  display: flex;
  flex-direction: column;
}

.widget-header {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: inherit;
}

.input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.phone-input {
  flex: 1;
  border: 1px solid #dadce0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 1rem;
  outline: none;
  background: #fff;
  color: #202124;
}

.phone-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.action-btn {
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0 16px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.action-btn:hover {
  opacity: 0.9;
}

.result-card {
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.formatted-number {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.alternatives-container {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

.label {
  color: #5f6368;
}

.value {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.flag-icon {
  width: 20px;
  height: 15px;
  border-radius: 2px;
  object-fit: cover;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.flag-icon-sm {
  width: 16px;
  height: 12px;
  border-radius: 1px;
  object-fit: cover;
}

.status-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  border: 1px solid #dadce0;
  background: #f8f9fa;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Dark mode overrides (naive implementation via global class check or media query not scoped) 
   But since we are in a Vue component, we can assume parent passes standard classes or we use media query.
   Existing app uses :global(.dark)
*/
:global(.dark) .phone-widget-container {
  color: #e8eaed;
}

:global(.dark) .phone-input {
  background: #1f2733;
  color: #e8eaed;
  border-color: #5f6368;
}

:global(.dark) .result-card {
  background: #2d3748;
  border-color: #5f6368;
}

:global(.dark) .label {
  color: #9aa0a6;
}

:global(.dark) .status-badge {
  background: #3c4043;
  color: #e8eaed;
  border-color: #5f6368;
}
</style>
