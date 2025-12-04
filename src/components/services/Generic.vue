<template>
  <div>
    <div class="card" :style="`background-color:${item.background};`">
      <div v-if="hasAnyExtra" class="doc-link" @click.stop>
        👉
        <span
          class="memo-icon"
          :class="{ 'has-memo': item.memo }"
          @click="$emit('memo-click', item)"
          @mouseenter="$emit('memo-hover', $event, item)"
          @mouseleave="$emit('memo-leave')"
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
  </div>
</template>

<script>
export default {
  name: "Generic",
  props: {
    item: Object,
  },
  emits: ["memo-click", "memo-hover", "memo-leave"],
  computed: {
    mediaClass: function () {
      return { media: true, "no-subtitle": !this.item.subtitle };
    },
    hasAnyExtra: function () {
      // Always show if item has id (for memo editing support)
      return this.item.id || this.item.memo || this.item.doc || this.item.video;
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
