<script setup lang="ts">
interface Receipt {
  id: string
  expenseId: string
  filename: string
  contentType: string
}

const props = defineProps<{ receipts: Receipt[] }>()

const images = computed(() => props.receipts.filter(r => r.contentType.startsWith('image/')))
const documents = computed(() => props.receipts.filter(r => !r.contentType.startsWith('image/')))
</script>

<template>
  <section
    v-if="receipts.length"
    class="print-break space-y-3"
  >
    <h3 class="font-medium border-b border-default pb-1">
      Receipts appendix
    </h3>

    <div
      v-if="images.length"
      class="grid grid-cols-2 sm:grid-cols-3 gap-3"
    >
      <figure
        v-for="receipt in images"
        :key="receipt.id"
        class="space-y-1"
      >
        <img
          :src="`/api/receipts/${receipt.id}`"
          :alt="receipt.filename"
          class="w-full rounded border border-default object-contain bg-elevated"
          loading="lazy"
        >
        <figcaption class="text-xs text-muted truncate">
          {{ receipt.filename }}
        </figcaption>
      </figure>
    </div>

    <div v-if="documents.length">
      <p class="text-sm font-medium">
        Documents
      </p>
      <ul class="text-sm list-disc ps-5">
        <li
          v-for="receipt in documents"
          :key="receipt.id"
        >
          <ULink
            :to="`/api/receipts/${receipt.id}`"
            target="_blank"
          >
            {{ receipt.filename }}
          </ULink>
        </li>
      </ul>
    </div>
  </section>
</template>
