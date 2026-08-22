<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Trip Ledger'
const description = 'Track business trip expenses with receipts and produce a finance-ready settlement report.'

useSeoMeta({
  title,
  titleTemplate: chunk => chunk === title ? title : `${chunk} · ${title}`,
  description,
  robots: 'noindex, nofollow'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
