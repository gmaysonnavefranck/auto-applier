<script setup lang="ts">
const router = useRouter()

defineProps<{
  label?: string
}>()
</script>

<template>
  <UButton
    variant="soft"
    icon="ph:arrow-left"
    @click="router.back()"
  >
    {{ label || "Go Back" }}
  </UButton>
</template>

<style scoped></style>
