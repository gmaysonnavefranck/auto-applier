<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { useRouter } from "vue-router"
import type { JobBoard } from "src/types/checklist"
import { emptyJobBoard } from "src/types/checklist"
import { useJobBoardsStore } from "src/stores/jobBoards.store"

const store = useJobBoardsStore()
const router = useRouter()

// Well-known developer job boards, offered as a one-click starting point.
const SUGGESTED_BOARDS: { name: string; url: string }[] = [
  { name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/" },
  { name: "Indeed", url: "https://www.indeed.com/" },
  {
    name: "We Work Remotely",
    url: "https://weworkremotely.com/categories/remote-programming-jobs",
  },
  { name: "Wellfound", url: "https://wellfound.com/jobs" },
  { name: "ZipRecruiter", url: "https://www.ziprecruiter.com/jobs-search" },
  { name: "Dice", url: "https://www.dice.com/" },
  { name: "Built In", url: "https://builtin.com/jobs" },
  { name: "Glassdoor", url: "https://www.glassdoor.com/Job/index.htm" },
  { name: "HN Hiring (aggregator)", url: "https://hnhiring.com/" },
  { name: "Otta", url: "https://otta.com/jobs" },
  { name: "RemoteOK", url: "https://remoteok.com/remote-dev-jobs" },
  { name: "Y Combinator Jobs", url: "https://www.workatastartup.com/jobs" },
  { name: "Arc.dev", url: "https://arc.dev/remote-jobs" },
  { name: "VanHack", url: "https://vanhack.com/jobs" },
  { name: "Remotive", url: "https://remotive.com/" },
  { name: "Himalayas", url: "https://himalayas.app/jobs" },
  { name: "Remote.co", url: "https://remote.co/remote-jobs/" },
]

const pendingSuggestions = computed(() =>
  SUGGESTED_BOARDS.filter(
    (s) => !store.boards.some((b) => b.url === s.url),
  ),
)

function addSuggested() {
  for (const s of pendingSuggestions.value) {
    store.addBoard({ id: crypto.randomUUID(), name: s.name, url: s.url })
  }
}

const showModal = ref(false)
const editing = ref<JobBoard | null>(null)

watch(showModal, (open) => {
  if (!open) editing.value = null
})

function openAdd() {
  editing.value = emptyJobBoard()
  showModal.value = true
}

function openEdit(board: JobBoard) {
  editing.value = structuredClone(toRaw(board))
  showModal.value = true
}

function save() {
  if (!editing.value?.name.trim() || !editing.value?.url.trim()) return

  const existing = store.boards.some((b) => b.id === editing.value!.id)
  if (existing) store.updateBoard(editing.value.id, editing.value)
  else store.addBoard(editing.value)

  showModal.value = false
  editing.value = null
}

function cancel() {
  showModal.value = false
  editing.value = null
}

function confirmRemove(board: JobBoard) {
  if (confirm(`Remove "${board.name}" from your daily list?`)) {
    store.removeBoard(board.id)
  }
}
</script>

<template>
  <div class="p-3 flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          size="xs"
          @click="router.push('/side-panel')"
        />
        <h2 class="font-semibold text-sm text-gray-900 dark:text-white">
          Daily Job Boards
        </h2>
      </div>
      <div class="flex gap-1.5">
        <UButton
          v-if="pendingSuggestions.length > 0"
          size="xs"
          variant="soft"
          color="neutral"
          icon="i-lucide-sparkles"
          @click="addSuggested"
        >
          Add suggested
        </UButton>
        <UButton
          size="xs"
          icon="i-lucide-plus"
          @click="openAdd"
        >
          Add board
        </UButton>
      </div>
    </div>

    <p class="text-xs text-gray-500">
      Check off each board once you've looked for new postings today. Resets
      automatically at midnight.
    </p>

    <!-- Empty state -->
    <div
      v-if="store.boards.length === 0"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <UIcon
        name="i-lucide-list-checks"
        class="text-4xl text-gray-300 mb-3"
      />
      <p class="text-sm text-gray-500">No job boards added yet.</p>
      <p class="text-xs text-gray-400 mt-1">
        Add the sites you check regularly for new postings.
      </p>
      <UButton
        size="xs"
        variant="soft"
        class="mt-3"
        icon="i-lucide-sparkles"
        @click="addSuggested"
      >
        Add suggested boards
      </UButton>
    </div>

    <!-- Board list -->
    <div
      v-for="board in store.boards"
      :key="board.id"
      class="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2.5"
    >
      <UButton
        size="xs"
        :variant="store.isVisitedToday(board) ? 'solid' : 'outline'"
        :color="store.isVisitedToday(board) ? 'success' : 'neutral'"
        :icon="
          store.isVisitedToday(board) ? 'i-lucide-check' : 'i-lucide-circle'
        "
        square
        @click="store.toggleVisited(board.id)"
      />

      <a
        :href="board.url"
        target="_blank"
        class="min-w-0 flex-1"
        :class="
          store.isVisitedToday(board) ? 'opacity-50' : ''
        "
      >
        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {{ board.name }}
        </p>
        <p class="text-xs text-gray-500 truncate">{{ board.url }}</p>
      </a>

      <div class="flex items-center gap-1 shrink-0">
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-pencil"
          @click="openEdit(board)"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="red"
          icon="i-lucide-trash-2"
          @click="confirmRemove(board)"
        />
      </div>
    </div>

    <UModal
      v-model:open="showModal"
      :ui="{ width: 'max-w-sm' }"
    >
      <template #content>
        <div
          v-if="editing"
          class="p-5 space-y-4"
        >
          <h3 class="font-semibold text-gray-900 dark:text-white">
            {{ store.boards.some((b) => b.id === editing!.id) ? "Edit" : "Add" }}
            Job Board
          </h3>

          <UFormField
            label="Name"
            required
          >
            <UInput
              v-model="editing.name"
              placeholder="LinkedIn Jobs"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="URL"
            required
          >
            <UInput
              v-model="editing.url"
              placeholder="https://www.linkedin.com/jobs/search/?keywords=..."
              class="w-full"
            />
          </UFormField>

          <div
            class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800"
          >
            <UButton
              variant="ghost"
              color="neutral"
              @click="cancel"
            >
              Cancel
            </UButton>
            <UButton
              :disabled="!editing.name.trim() || !editing.url.trim()"
              @click="save"
            >
              Save
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
