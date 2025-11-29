<template>
  <a
    href="https://m.moji.com/forecast15/japan/tokyo/tokyo"
    target="_blank"
    class="weather-widget navbar-item"
    v-if="weather"
  >
    <i :class="weatherIcon"></i>
    <span class="temp">{{ weather.temperature }}°C</span>
  </a>
</template>

<script>
export default {
  name: "WeatherWidget",
  data() {
    return {
      weather: null,
      timer: null,
    };
  },
  computed: {
    weatherIcon() {
      if (!this.weather) return "fas fa-spinner fa-spin";
      const code = this.weather.weathercode;
      // WMO Weather interpretation codes (WW)
      // https://open-meteo.com/en/docs
      if (code === 0) return "fas fa-sun"; // Clear sky
      if (code >= 1 && code <= 3) return "fas fa-cloud-sun"; // Mainly clear, partly cloudy, and overcast
      if (code >= 45 && code <= 48) return "fas fa-smog"; // Fog
      if (code >= 51 && code <= 67) return "fas fa-cloud-rain"; // Drizzle, Rain
      if (code >= 71 && code <= 77) return "fas fa-snowflake"; // Snow
      if (code >= 80 && code <= 82) return "fas fa-cloud-showers-heavy"; // Rain showers
      if (code >= 85 && code <= 86) return "fas fa-snowflake"; // Snow showers
      if (code >= 95 && code <= 99) return "fas fa-bolt"; // Thunderstorm
      return "fas fa-cloud";
    },
  },
  mounted() {
    this.fetchWeather();
    // Refresh every 30 minutes
    this.timer = setInterval(this.fetchWeather, 30 * 60 * 1000);
  },
  beforeUnmount() {
    if (this.timer) clearInterval(this.timer);
  },
  methods: {
    async fetchWeather() {
      try {
        const response = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&current_weather=true"
        );
        const data = await response.json();
        this.weather = data.current_weather;
      } catch (error) {
        console.error("Failed to fetch weather:", error);
      }
    },
  },
};
</script>

<style scoped lang="scss">
.weather-widget {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-header);
  font-weight: bold;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
    background-color: transparent !important; /* Override navbar item hover */
    color: var(--text-header) !important;
  }

  i {
    font-size: 1.2em;
    color: #ff9f43; /* Use the same orange as the doc link for consistency */
  }
}
</style>
