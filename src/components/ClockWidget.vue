<template>
  <div class="clock-widget navbar-item">
    <div class="time-group">
      <img
        src="/assets/flags/cn.png"
        width="20"
        alt="China"
        class="flag-icon"
      />
      <span class="time">{{ cnTime }}</span>
    </div>
    <div class="divider">|</div>
    <div class="time-group">
      <img
        src="/assets/flags/jp.png"
        width="20"
        alt="Japan"
        class="flag-icon"
      />
      <span class="time">{{ jpTime }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: "ClockWidget",
  data() {
    return {
      cnTime: "",
      jpTime: "",
      timer: null,
    };
  },
  mounted() {
    this.updateTime();
    this.timer = setInterval(this.updateTime, 1000);
  },
  beforeUnmount() {
    if (this.timer) clearInterval(this.timer);
  },
  methods: {
    updateTime() {
      const now = new Date();

      // China Time (UTC+8)
      this.cnTime = now.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Japan Time (UTC+9)
      this.jpTime = now.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  },
};
</script>

<style scoped lang="scss">
.clock-widget {
  display: flex;
  align-items: center;
  font-family: "Noto Sans", sans-serif;
  font-variant-numeric: tabular-nums;
  font-weight: bold;
  color: var(--text-header);
  gap: 0.1rem;
  white-space: nowrap;

  .time-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .flag-icon {
    display: block;
    height: auto;
    border-radius: 2px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .divider {
    margin: 0 8px;
    opacity: 0.35;
  }
}
</style>
