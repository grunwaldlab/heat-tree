<template>
  <div ref="container" class="heat-tree-demo">
    <!-- SSR placeholder - replaced on client -->
    <div v-if="!isMounted" class="demo-placeholder" :style="{ height }">
      <div class="loading">Loading demo...</div>
    </div>
    <!-- Live demo in iframe (client only) -->
    <iframe
      v-else-if="code"
      :srcdoc="code"
      :style="{ height }"
      frameborder="0"
      class="demo-iframe"
      sandbox="allow-scripts allow-same-origin"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  height: {
    type: String,
    default: '70vh'
  }
})

const container = ref(null)
const code = ref('')
const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
  
  // Find the previous code block
  if (!container.value) return
  
  // Get the parent element
  const parent = container.value.parentElement
  if (!parent) return
  
  // Find the previous sibling that contains a code block
  let prev = container.value.previousElementSibling
  while (prev) {
    const codeBlock = prev.querySelector('pre code')
    if (codeBlock) {
      code.value = codeBlock.textContent || ''
      break
    }
    prev = prev.previousElementSibling
  }
})
</script>

<style scoped>
.heat-tree-demo {
  margin: 0 0 16px 0;
  border: 3px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.demo-placeholder {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg-soft);
}

.loading {
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.demo-iframe {
  width: 100%;
  border-top: none;
  background: white;
}

</style>
