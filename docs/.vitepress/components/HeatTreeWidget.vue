<template>
  <ClientOnly>
    <div :id="containerId" class="heat-tree-widget" :style="{ height }"></div>
  </ClientOnly>
</template>

<script setup>
import { onMounted } from 'vue'

const props = defineProps({
  run: {
    type: Function,
    required: true
  },
  height: {
    type: String,
    default: '400px'
  }
})

const containerId = 'heat-tree-' + Math.random().toString(36).substr(2, 9)

onMounted(async () => {
  if (typeof window === 'undefined') return
  
  try {
    const { heatTree } = await import('../../public/dist/heat-tree.es.min.js')
    await props.run(containerId, heatTree)
  } catch (error) {
    console.error('Error running heat-tree example:', error)
    const el = document.getElementById(containerId)
    if (el) {
      el.innerHTML = '<div style="padding:16px;color:#c00;">Error: ' + error.message + '</div>'
    }
  }
})
</script>

<style scoped>
.heat-tree-widget {
  border: 1px solid #ddd;
  overflow: hidden;
  width: 100%;
}
</style>
