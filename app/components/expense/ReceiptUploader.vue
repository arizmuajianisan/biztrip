<script setup lang="ts">
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 10

const props = defineProps<{ expenseId?: string }>()

interface SavedReceipt {
  id: string
  filename: string
  contentType: string
  size: number
}

const pending = ref<File[]>([])
const previews = ref<Map<File, string>>(new Map())
const saved = ref<SavedReceipt[]>([])
const error = ref<string | null>(null)
const busy = ref(false)
const input = useTemplateRef<HTMLInputElement>('input')

async function loadSaved() {
  if (!props.expenseId) {
    saved.value = []
    return
  }
  saved.value = await $fetch<SavedReceipt[]>(`/api/expenses/${props.expenseId}/receipts`)
}

watch(() => props.expenseId, loadSaved, { immediate: true })

const total = computed(() => saved.value.length + pending.value.length)

function addFiles(files: FileList | null) {
  if (!files) return
  error.value = null
  for (const file of Array.from(files)) {
    if (!ALLOWED.includes(file.type)) {
      error.value = `${file.name}: only JPG, PNG, WebP and PDF are accepted.`
      continue
    }
    if (file.size > MAX_BYTES) {
      error.value = `${file.name}: larger than 10 MB.`
      continue
    }
    if (total.value >= MAX_FILES) {
      error.value = `At most ${MAX_FILES} receipts per expense.`
      break
    }
    pending.value.push(file)
    if (file.type.startsWith('image/')) {
      previews.value.set(file, URL.createObjectURL(file))
    }
  }
  if (input.value) input.value.value = ''
}

function removePending(file: File) {
  const url = previews.value.get(file)
  if (url) {
    URL.revokeObjectURL(url)
    previews.value.delete(file)
  }
  pending.value = pending.value.filter(f => f !== file)
}

async function removeSaved(receipt: SavedReceipt) {
  busy.value = true
  try {
    await $fetch(`/api/receipts/${receipt.id}`, { method: 'DELETE' })
    saved.value = saved.value.filter(r => r.id !== receipt.id)
  } finally {
    busy.value = false
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  addFiles(event.dataTransfer?.files ?? null)
}

/** Uploads everything staged locally. Called by the parent once the expense exists. */
async function upload(expenseId: string) {
  if (!pending.value.length) return
  const body = new FormData()
  for (const file of pending.value) body.append('receipts', file, file.name)
  await $fetch(`/api/expenses/${expenseId}/receipts`, { method: 'POST', body })
  for (const url of previews.value.values()) URL.revokeObjectURL(url)
  previews.value.clear()
  pending.value = []
}

onUnmounted(() => {
  for (const url of previews.value.values()) URL.revokeObjectURL(url)
})

defineExpose({ upload })
</script>

<template>
  <div class="space-y-3">
    <div
      class="border border-dashed border-accented rounded-lg p-4 text-center cursor-pointer hover:bg-elevated/50 transition-colors"
      @click="input?.click()"
      @dragover.prevent
      @drop="onDrop"
    >
      <UIcon
        name="i-lucide-image-up"
        class="size-6 text-muted"
      />
      <p class="text-sm mt-1">
        Drop receipt photos here, or click to choose
      </p>
      <p class="text-xs text-muted">
        JPG, PNG, WebP or PDF · up to 10 MB each · {{ total }}/{{ MAX_FILES }} attached
      </p>
      <input
        ref="input"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf"
        class="hidden"
        @change="addFiles(($event.target as HTMLInputElement).files)"
      >
    </div>

    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="error"
    />

    <div
      v-if="saved.length || pending.length"
      class="grid grid-cols-3 sm:grid-cols-4 gap-2"
    >
      <div
        v-for="receipt in saved"
        :key="receipt.id"
        class="relative group aspect-square rounded-md overflow-hidden border border-default bg-elevated"
      >
        <img
          v-if="receipt.contentType.startsWith('image/')"
          :src="`/api/receipts/${receipt.id}`"
          :alt="receipt.filename"
          class="size-full object-cover"
        >
        <div
          v-else
          class="size-full flex items-center justify-center"
        >
          <UIcon
            name="i-lucide-file-text"
            class="size-6 text-muted"
          />
        </div>
        <UButton
          icon="i-lucide-x"
          color="error"
          size="sm"
          :disabled="busy"
          class="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
          @click="removeSaved(receipt)"
        />
      </div>

      <div
        v-for="file in pending"
        :key="file.name + file.size"
        class="relative group aspect-square rounded-md overflow-hidden border border-dashed border-accented bg-elevated"
      >
        <img
          v-if="previews.get(file)"
          :src="previews.get(file)"
          :alt="file.name"
          class="size-full object-cover"
        >
        <div
          v-else
          class="size-full flex items-center justify-center"
        >
          <UIcon
            name="i-lucide-file-text"
            class="size-6 text-muted"
          />
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          size="sm"
          class="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
          @click="removePending(file)"
        />
      </div>
    </div>
  </div>
</template>
