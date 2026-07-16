<script setup lang="ts">
import { ref } from "vue"
import { useResumeStore } from "src/stores/resume.store"
import { useAiStore } from "src/stores/ai.store"
import { useGoalsStore } from "src/stores/goals.store"
import { exportBackup, importBackup } from "src/utils/backup"
import type {
  ResumeWork,
  ResumeEducation,
  ResumeSkillGroup,
  ResumeLanguage,
  Resume,
} from "src/types/resume"
import {
  emptyWork,
  emptyEducation,
  emptySkillGroup,
  emptyLanguage,
  PROFICIENCY_OPTIONS,
} from "src/types/resume"

const store = useResumeStore()
const aiStore = useAiStore()
const goalsStore = useGoalsStore()

// ─── Backup ──────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const backupMsg = ref("")
const backupError = ref(false)

async function handleExport() {
  await exportBackup()
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (
    !confirm(
      "This overwrites your current sites, applications, resume, and job board list with the contents of this file. Continue?",
    )
  ) {
    input.value = ""
    return
  }

  try {
    await importBackup(file)
    backupError.value = false
    backupMsg.value =
      "Backup restored. Open the side panel to see your sites and applications."
  } catch (err) {
    backupError.value = true
    backupMsg.value =
      err instanceof Error ? err.message : "Could not import this file."
  } finally {
    input.value = ""
  }
}

// ─── Basics ──────────────────────────────────────────────────────────────────
function updateBasic(key: string, val: string) {
  store.updateBasics({ [key]: val })
}

// ─── Work ────────────────────────────────────────────────────────────────────
const showWorkModal = ref(false)
const editingWork = ref<ResumeWork | null>(null)
const newBullet = ref("")

watch(showWorkModal, (open) => {
  if (!open) editingWork.value = null
})

function openWork(entry?: ResumeWork) {
  editingWork.value = entry ? structuredClone(toRaw(entry)) : emptyWork()
  newBullet.value = ""
  showWorkModal.value = true
}

function addBullet() {
  const text = newBullet.value.trim()
  if (!text || !editingWork.value) return
  editingWork.value.highlights.push(text)
  newBullet.value = ""
}

function removeBullet(i: number) {
  editingWork.value?.highlights.splice(i, 1)
}

function saveWork() {
  if (!editingWork.value?.company || !editingWork.value?.position) return
  store.upsertWork(editingWork.value)
  showWorkModal.value = false
  editingWork.value = null
}

function cancelWork() {
  showWorkModal.value = false
  editingWork.value = null
}

// ─── Education ───────────────────────────────────────────────────────────────
const showEduModal = ref(false)
const editingEdu = ref<ResumeEducation | null>(null)

watch(showEduModal, (open) => {
  if (!open) editingEdu.value = null
})

function openEdu(entry?: ResumeEducation) {
  editingEdu.value = entry ? structuredClone(toRaw(entry)) : emptyEducation()
  showEduModal.value = true
}

function saveEdu() {
  if (!editingEdu.value?.institution || !editingEdu.value?.degree) return
  store.upsertEducation(editingEdu.value)
  showEduModal.value = false
  editingEdu.value = null
}

function cancelEdu() {
  showEduModal.value = false
  editingEdu.value = null
}

// ─── Skills ──────────────────────────────────────────────────────────────────
const showSkillModal = ref(false)
const editingSkill = ref<ResumeSkillGroup | null>(null)
const newSkillItem = ref("")

watch(showSkillModal, (open) => {
  if (!open) editingSkill.value = null
})

function openSkill(entry?: ResumeSkillGroup) {
  editingSkill.value = entry ? structuredClone(toRaw(entry)) : emptySkillGroup()
  newSkillItem.value = ""
  showSkillModal.value = true
}

function addSkillItem() {
  const text = newSkillItem.value.trim()
  if (!text || !editingSkill.value) return
  editingSkill.value.items.push(
    ...text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  newSkillItem.value = ""
}

function removeSkillItem(i: number) {
  editingSkill.value?.items.splice(i, 1)
}

function saveSkill() {
  if (!editingSkill.value?.category) return
  store.upsertSkillGroup(editingSkill.value)
  showSkillModal.value = false
  editingSkill.value = null
}

function cancelSkill() {
  showSkillModal.value = false
  editingSkill.value = null
}

// ─── Languages ───────────────────────────────────────────────────────────────
const showLangModal = ref(false)
const editingLang = ref<ResumeLanguage | null>(null)

watch(showLangModal, (open) => {
  if (!open) editingLang.value = null
})

function openLang(entry?: ResumeLanguage) {
  editingLang.value = entry ? structuredClone(toRaw(entry)) : emptyLanguage()
  showLangModal.value = true
}

function saveLang() {
  if (!editingLang.value?.name) return
  store.upsertLanguage(editingLang.value)
  showLangModal.value = false
  editingLang.value = null
}

function cancelLang() {
  showLangModal.value = false
  editingLang.value = null
}

// ─── Pre-fill ────────────────────────────────────────────────────────────────
const MY_RESUME: Resume = {
  basics: {
    name: "Gustavo Maysonnave Franck",
    email: "gmaysonnavefranck@gmail.com",
    title: "Senior Full-Stack Engineer",
    phone: "+5541992422405",
    location: "Brazil, Curitiba",
    summary:
      "Senior Fullstack Engineer with 9+ years of experience building complex web applications for U.S. startups and enterprise products across AI, e-commerce, healthcare, ERP, and smart city platforms. Specialized in Vue.js, TypeScript, and modern frontend architecture, with extensive experience creating scalable design systems, highly interactive user interfaces, and accessible products. Experienced across the stack with Laravel and Spring Boot, collaborating closely with product, design, and engineering teams to deliver scalable software.",
    github: "https://github.com/gmaysonnavefranck",
    linkedin: "https://www.linkedin.com/in/gmaysonnavefranck",
    website: "",
  },
  work: [
    {
      id: crypto.randomUUID(),
      company: "Jobscan",
      position: "Senior Full-Stack Engineer",
      companyDescription:
        "AI-powered career platform helping job seekers optimize resumes and improve application success.",
      location: "Seattle · Remote",
      startDate: "March 2023",
      endDate: "",
      highlights: [
        "Developed and maintained a complex Vue.js resume editor featuring AI-powered resume rewriting, contextual improvement suggestions, and interactive editing tools.",
        "Engineered complex interactive editing experiences using advanced CSS and reactive Vue.js components to provide real-time visual feedback during resume creation.",
        "Improved accessibility across core product features by implementing WCAG-compliant interfaces and interaction patterns.",
        "Developed reusable WordPress components and implemented SEO-focused improvements, ensuring design consistency, maintainability, and search engine optimization across marketing websites.",
        "Extended the platform through Chrome extension development, integrating resume optimization directly into users' job application workflow.",
        "Collaborated cross-functionally with Product and Design to translate requirements into scalable frontend solutions.",
        "Documented reusable frontend components and established implementation guidelines to improve maintainability and developer onboarding.",
        "Developed Laravel APIs supporting resume parsing, AI-powered recommendations, and job description matching within a Dockerized development environment.",
        "Established AI-assisted development workflows by creating custom Claude Code skills and leveraging LLMs to accelerate implementation, debugging, testing, documentation, and code review.",
        "Implemented experimentation tooling including A/B tests, feature flags, and analytics integrations to support data-driven product development and incremental feature rollouts.",
      ],
    },
    {
      id: crypto.randomUUID(),
      company: "Leaflink",
      position: "Senior Frontend Developer",
      companyDescription:
        "One of the largest cannabis e-commerce platforms in the U.S.",
      location: "New York · Remote",
      startDate: "October 2021",
      endDate: "March 2023",
      highlights: [
        "Developed customer-facing features for one of the largest cannabis B2B marketplaces in the U.S., using Vue 3, Pinia, Vuex, Vite, and Vitest.",
        "Developed and maintained reusable UI components for the company's internal component library.",
        "Collaborated daily with designers and product managers to deliver high-fidelity, user-focused interfaces.",
        "Delivered responsive and accessible interfaces while maintaining UI consistency across customer-facing applications.",
        "Maintained a high standard of unit testing and contributed to a culture of code quality and maintainability.",
        "Worked in a Docker-based environment, supporting scalable development and deployment workflows.",
        "Participated in CI/CD workflows, validating releases through automated testing before deployment.",
      ],
    },
    {
      id: crypto.randomUUID(),
      company: "Inflor",
      position: "Senior Frontend Developer",
      companyDescription: "ERP platform for planted forest management.",
      location: "Remote",
      startDate: "August 2019",
      endDate: "October 2021",
      highlights: [
        "Built the pilot module from scratch using Vue, Vuex, and Vuetify, establishing technical and UI/UX standards for future modules.",
        "Spearheaded front-end development of a new ERP module as part of the company's modernization effort after 15+ years on legacy systems.",
        "Participated in early-stage planning with back-end engineers, product managers, product owners, and designers to define architecture and workflows.",
        "Worked with existing component libraries and a micro-frontend architecture to ensure reusability and scalability across the platform.",
        "Played a key role in aligning front-end practices with long-term goals for modernization and maintainability.",
      ],
    },
    {
      id: crypto.randomUUID(),
      company: "Filoo",
      position: "Full-stack Developer",
      companyDescription:
        "Online healthcare platform for finding doctors and managing health plans.",
      location: "São Paulo · Remote",
      startDate: "July 2018",
      endDate: "August 2019",
      highlights: [
        "Developed features across the stack using Vue.js on the front end and Laravel on the back end.",
        "Built and maintained a search platform for users to find doctors and medications based on location and specialty.",
        "Implemented Stripe payment integration supporting subscription management and online healthcare plan purchases.",
        "Improved and refactored existing Vue components and pages, enhancing style consistency, performance, and responsiveness.",
        "Collaborated with cross-functional teams to ensure a smooth user experience and reliable backend services.",
      ],
    },
    {
      id: crypto.randomUUID(),
      company: "Exati",
      position: "Full-stack Developer",
      companyDescription:
        "Smart City ERP for public lighting management used by city halls.",
      location: "Curitiba · Remote",
      startDate: "June 2017",
      endDate: "July 2018",
      highlights: [
        "Migrated a legacy Flash-based system to a modern front end using Vue 2 and Vuetify, building custom components and implementing new design standards.",
        "Redesigned legacy Flash interfaces into modern, responsive Vue.js applications while preserving business functionality.",
        "Ported large portions of the platform UI, ensuring feature parity while enhancing usability and performance.",
        "Maintained and improved the mobile application used by citizens to request public lighting maintenance.",
        "Developed and maintained Laravel back-end features to support new functionality and improve system reliability.",
        "Integrated interactive maps to visually display the location, type, and installation team for all public lighting units.",
      ],
    },
    {
      id: crypto.randomUUID(),
      company: "Gear Up",
      position: "Jr Full-stack Developer",
      companyDescription:
        "B2B CRM and lead enrichment platform for Brazilian companies.",
      location: "Curitiba",
      startDate: "February 2017",
      endDate: "June 2017",
      highlights: [
        "Developed backend features using Laravel, supporting data processing and lead enrichment based on public records of Brazilian companies.",
        "Built and maintained CRM workflows supporting a full sales pipeline: prospects → leads → opportunities → clients.",
        "Created custom dashboards to give users actionable insights on potential clients and lead performance.",
        "Contributed to the search and filtering engine allowing users to find companies by sector.",
        "Made UI improvements using Laravel Blade templates, enhancing usability across multiple views.",
      ],
    },
  ],
  education: [
    {
      id: crypto.randomUUID(),
      institution: "UTFPR – Universidade Tecnológica Federal do Paraná",
      degree: "Bachelor",
      field: "Computer Engineering",
      startDate: "June 2016",
      endDate: "June 2023",
    },
  ],
  skills: [
    {
      id: crypto.randomUUID(),
      category: "Frontend",
      items: [
        "Vue.js",
        "Vue 3",
        "Vue 2",
        "TypeScript",
        "JavaScript",
        "HTML5",
        "CSS3",
        "SASS",
        "SCSS",
        "Pinia",
        "Vuex",
        "Vuetify",
        "Vite",
        "Figma",
        "Laravel Blade",
      ],
    },
    {
      id: crypto.randomUUID(),
      category: "Frontend Architecture",
      items: [
        "Design Systems",
        "Component Libraries",
        "SPA Development",
        "Responsive Design",
        "Accessibility (WCAG)",
        "Technical SEO",
        "State Management",
        "Performance Optimization",
        "Micro-frontends",
        "Component-Driven Development",
        "Cross-browser Compatibility",
        "Semantic HTML",
        "Progressive Enhancement",
      ],
    },
    {
      id: crypto.randomUUID(),
      category: "DevOps & Tools",
      items: ["Docker", "Git", "CI/CD", "AWS"],
    },
    {
      id: crypto.randomUUID(),
      category: "Backend",
      items: [
        "REST APIs",
        "PHP",
        "Laravel",
        "Java",
        "Spring Boot",
        "MySQL",
        "PostgreSQL",
      ],
    },
    {
      id: crypto.randomUUID(),
      category: "Testing",
      items: [
        "Vitest",
        "Jest",
        "Playwright",
        "PHPUnit",
        "Unit Testing",
        "End-to-End Testing",
      ],
    },
    {
      id: crypto.randomUUID(),
      category: "AI-Assisted Development",
      items: [
        "Claude Code",
        "OpenAI GPT",
        "GitHub Copilot",
        "AI-Assisted Development",
        "AI Code Review",
        "AI Debugging",
        "AI Test Generation",
        "AI Workflow Automation",
        "Prompt Engineering",
      ],
    },
  ],
  languages: [
    { id: crypto.randomUUID(), name: "English", proficiency: "Fluent" },
    { id: crypto.randomUUID(), name: "Portuguese", proficiency: "Native" },
  ],
}

function prefill() {
  store.importResume(MY_RESUME)
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8 space-y-10">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">
          Configuration
        </h1>
        <p class="text-sm text-gray-500">
          Claude API key and base resume, saved locally on this device.
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          size="xs"
          variant="soft"
          color="neutral"
          icon="i-lucide-download"
          @click="prefill"
        >
          Load my data
        </UButton>
        <UButton
          size="xs"
          variant="soft"
          icon="i-lucide-eye"
          @click="$router.push('/options-page/resume-preview')"
        >
          Preview
        </UButton>
      </div>
    </div>

    <!-- ── Claude API Key ─────────────────────────────────────────────────── -->
    <section class="space-y-3">
      <h2
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
      >
        Claude API Key
      </h2>

      <UFormField label="Anthropic API Key">
        <UInput
          :model-value="aiStore.claudeApiKey"
          type="password"
          placeholder="sk-ant-..."
          class="w-full"
          @change="
            aiStore.claudeApiKey = ($event.target as HTMLInputElement).value
          "
        />
      </UFormField>
      <p class="text-[11px] text-gray-400">
        Stored locally. Used to call the Anthropic API directly from your
        browser when tailoring a resume for a job.
      </p>
    </section>

    <USeparator />

    <!-- ── Daily Goal ──────────────────────────────────────────────────────── -->
    <section class="space-y-3">
      <h2
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
      >
        Daily Goal
      </h2>

      <UFormField label="Applications per day">
        <UInput
          :model-value="goalsStore.dailyTarget || undefined"
          type="number"
          min="0"
          placeholder="0 (disabled)"
          class="w-full"
          @change="
            goalsStore.dailyTarget =
              Number(($event.target as HTMLInputElement).value) || 0
          "
        />
      </UFormField>
      <p class="text-[11px] text-gray-400">
        Set to 0 to hide the progress indicator in the side panel.
      </p>
    </section>

    <USeparator />

    <!-- ── Basics ─────────────────────────────────────────────────────────── -->
    <section class="space-y-4">
      <h2
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
      >
        Basics
      </h2>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Full Name">
          <UInput
            :model-value="store.resume.basics.name"
            placeholder="Jane Doe"
            class="w-full"
            @change="
              updateBasic('name', ($event.target as HTMLInputElement).value)
            "
          />
        </UFormField>
        <UFormField label="Email">
          <UInput
            :model-value="store.resume.basics.email"
            placeholder="jane@example.com"
            type="email"
            class="w-full"
            @change="
              updateBasic('email', ($event.target as HTMLInputElement).value)
            "
          />
        </UFormField>
        <UFormField
          label="Job Title"
          class="col-span-2"
        >
          <UInput
            :model-value="store.resume.basics.title ?? ''"
            placeholder="Senior Frontend Developer"
            class="w-full"
            @change="
              updateBasic('title', ($event.target as HTMLInputElement).value)
            "
          />
          <p class="text-[11px] text-gray-400 mt-1">
            Claude will tailor this headline to match each job posting.
          </p>
        </UFormField>
        <UFormField label="Phone">
          <UInput
            :model-value="store.resume.basics.phone ?? ''"
            placeholder="+1 555 000 0000"
            class="w-full"
            @change="
              updateBasic('phone', ($event.target as HTMLInputElement).value)
            "
          />
        </UFormField>
        <UFormField label="Location">
          <UInput
            :model-value="store.resume.basics.location ?? ''"
            placeholder="San Francisco, CA"
            class="w-full"
            @change="
              updateBasic('location', ($event.target as HTMLInputElement).value)
            "
          />
        </UFormField>
        <UFormField label="GitHub">
          <UInput
            :model-value="store.resume.basics.github ?? ''"
            placeholder="https://github.com/you"
            class="w-full"
            @change="
              updateBasic('github', ($event.target as HTMLInputElement).value)
            "
          />
        </UFormField>
        <UFormField label="LinkedIn">
          <UInput
            :model-value="store.resume.basics.linkedin ?? ''"
            placeholder="https://linkedin.com/in/you"
            class="w-full"
            @change="
              updateBasic('linkedin', ($event.target as HTMLInputElement).value)
            "
          />
        </UFormField>
      </div>

      <UFormField label="Professional Summary">
        <UTextarea
          :model-value="store.resume.basics.summary ?? ''"
          placeholder="Brief summary…"
          :rows="3"
          class="w-full"
          @change="
            updateBasic('summary', ($event.target as HTMLTextAreaElement).value)
          "
        />
      </UFormField>
    </section>

    <USeparator />

    <!-- ── Work Experience ───────────────────────────────────────────────── -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
        >
          Work Experience
        </h2>
        <UButton
          size="xs"
          icon="i-lucide-plus"
          @click="openWork()"
        >
          Add
        </UButton>
      </div>

      <div class="space-y-2">
        <div
          v-for="entry in store.resume.work"
          :key="entry.id"
          class="flex items-start justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5 bg-white dark:bg-gray-950"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ entry.position }}
            </p>
            <p class="text-xs text-gray-500">
              {{ entry.company
              }}{{ entry.location ? ` · ${entry.location}` : "" }} ·
              {{ entry.startDate }}–{{ entry.endDate || "Present" }}
            </p>
            <p
              v-if="entry.companyDescription"
              class="text-xs text-gray-400 mt-0.5 italic"
            >
              {{ entry.companyDescription }}
            </p>
            <p class="text-xs text-gray-400 mt-0.5">
              {{ entry.highlights.length }} bullet{{
                entry.highlights.length !== 1 ? "s" : ""
              }}
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              @click="openWork(entry)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="red"
              icon="i-lucide-trash-2"
              @click="store.removeWork(entry.id)"
            />
          </div>
        </div>
        <p
          v-if="store.resume.work.length === 0"
          class="text-sm text-gray-400 italic"
        >
          No work experience added yet.
        </p>
      </div>

      <UModal
        v-model:open="showWorkModal"
        :ui="{ width: 'max-w-lg' }"
      >
        <template #content>
          <div
            v-if="editingWork"
            class="p-5 space-y-4"
          >
            <h3 class="font-semibold text-gray-900 dark:text-white">
              Work Experience
            </h3>

            <div class="grid grid-cols-2 gap-3">
              <UFormField
                label="Company"
                required
              >
                <UInput
                  v-model="editingWork.company"
                  placeholder="Acme Corp"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Position"
                required
              >
                <UInput
                  v-model="editingWork.position"
                  placeholder="Software Engineer"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Company Description"
                class="col-span-2"
              >
                <UInput
                  v-model="editingWork.companyDescription"
                  placeholder="One-line description of what the company does"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Location">
                <UInput
                  v-model="editingWork.location"
                  placeholder="Remote"
                  class="w-full"
                />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Start">
                  <UInput
                    v-model="editingWork.startDate"
                    placeholder="Jan 2022"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="End">
                  <UInput
                    v-model="editingWork.endDate"
                    placeholder="Present"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>

            <div>
              <p
                class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Bullet Points
                <span class="text-[10px] text-gray-400 font-normal ml-1">
                  — Claude tailors these per job
                </span>
              </p>
              <div class="space-y-1.5 mb-2">
                <div
                  v-for="(bullet, i) in editingWork.highlights"
                  :key="i"
                  class="flex items-start gap-2"
                >
                  <UTextarea
                    :model-value="bullet"
                    size="sm"
                    :rows="2"
                    class="flex-1 text-sm"
                    @change="
                      editingWork!.highlights[i] = (
                        $event.target as HTMLTextAreaElement
                      ).value
                    "
                  />
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="red"
                    icon="i-lucide-x"
                    class="mt-1 shrink-0"
                    @click="removeBullet(i)"
                  />
                </div>
                <p
                  v-if="editingWork.highlights.length === 0"
                  class="text-xs text-gray-400 italic"
                >
                  No bullets yet.
                </p>
              </div>
              <div class="flex gap-2">
                <UInput
                  v-model="newBullet"
                  size="sm"
                  placeholder="Add a bullet point…"
                  class="flex-1"
                  @keydown.enter.prevent="addBullet"
                />
                <UButton
                  size="sm"
                  variant="soft"
                  icon="i-lucide-plus"
                  @click="addBullet"
                >
                  Add
                </UButton>
              </div>
            </div>

            <div
              class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800"
            >
              <UButton
                variant="ghost"
                color="neutral"
                @click="cancelWork"
              >
                Cancel
              </UButton>
              <UButton
                :disabled="!editingWork.company || !editingWork.position"
                @click="saveWork"
              >
                Save
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </section>

    <USeparator />

    <!-- ── Education ─────────────────────────────────────────────────────── -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
        >
          Education
        </h2>
        <UButton
          size="xs"
          icon="i-lucide-plus"
          @click="openEdu()"
        >
          Add
        </UButton>
      </div>

      <div class="space-y-2">
        <div
          v-for="entry in store.resume.education"
          :key="entry.id"
          class="flex items-start justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5 bg-white dark:bg-gray-950"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ entry.degree }}{{ entry.field ? ` in ${entry.field}` : "" }}
            </p>
            <p class="text-xs text-gray-500">
              {{ entry.institution }} · {{ entry.startDate }}–{{
                entry.endDate || "Present"
              }}
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              @click="openEdu(entry)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="red"
              icon="i-lucide-trash-2"
              @click="store.removeEducation(entry.id)"
            />
          </div>
        </div>
        <p
          v-if="store.resume.education.length === 0"
          class="text-sm text-gray-400 italic"
        >
          No education entries yet.
        </p>
      </div>

      <UModal
        v-model:open="showEduModal"
        :ui="{ width: 'max-w-md' }"
      >
        <template #content>
          <div
            v-if="editingEdu"
            class="p-5 space-y-4"
          >
            <h3 class="font-semibold text-gray-900 dark:text-white">
              Education
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <UFormField
                label="Institution"
                required
                class="col-span-2"
              >
                <UInput
                  v-model="editingEdu.institution"
                  placeholder="MIT"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Degree"
                required
              >
                <UInput
                  v-model="editingEdu.degree"
                  placeholder="B.S."
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Field of Study">
                <UInput
                  v-model="editingEdu.field"
                  placeholder="Computer Science"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Start">
                <UInput
                  v-model="editingEdu.startDate"
                  placeholder="Sep 2018"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="End">
                <UInput
                  v-model="editingEdu.endDate"
                  placeholder="May 2022"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="GPA"
                class="col-span-2"
              >
                <UInput
                  v-model="editingEdu.gpa"
                  placeholder="3.8"
                  class="w-full"
                />
              </UFormField>
            </div>
            <div
              class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800"
            >
              <UButton
                variant="ghost"
                color="neutral"
                @click="cancelEdu"
              >
                Cancel
              </UButton>
              <UButton
                :disabled="!editingEdu.institution || !editingEdu.degree"
                @click="saveEdu"
              >
                Save
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </section>

    <USeparator />

    <!-- ── Skills ────────────────────────────────────────────────────────── -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
        >
          Skills
        </h2>
        <UButton
          size="xs"
          icon="i-lucide-plus"
          @click="openSkill()"
        >
          Add Category
        </UButton>
      </div>

      <div class="space-y-2">
        <div
          v-for="group in store.resume.skills"
          :key="group.id"
          class="flex items-start justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5 bg-white dark:bg-gray-950"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {{ group.category }}
            </p>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="item in group.items"
                :key="item"
                variant="subtle"
                color="neutral"
                size="xs"
              >
                {{ item }}
              </UBadge>
            </div>
          </div>
          <div class="flex gap-1 shrink-0">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              @click="openSkill(group)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="red"
              icon="i-lucide-trash-2"
              @click="store.removeSkillGroup(group.id)"
            />
          </div>
        </div>
        <p
          v-if="store.resume.skills.length === 0"
          class="text-sm text-gray-400 italic"
        >
          No skill categories yet.
        </p>
      </div>

      <UModal
        v-model:open="showSkillModal"
        :ui="{ width: 'max-w-md' }"
      >
        <template #content>
          <div
            v-if="editingSkill"
            class="p-5 space-y-4"
          >
            <h3 class="font-semibold">Skill Category</h3>
            <UFormField
              label="Category name"
              required
            >
              <UInput
                v-model="editingSkill.category"
                placeholder="Languages, Frameworks, Tools…"
                class="w-full"
              />
            </UFormField>
            <div>
              <p
                class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Skills
              </p>
              <div class="flex flex-wrap gap-1.5 mb-2 min-h-8">
                <div
                  v-for="(item, i) in editingSkill.items"
                  :key="i"
                  class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5"
                >
                  <span class="text-xs text-gray-700 dark:text-gray-300">
                    {{ item }}
                  </span>
                  <button
                    class="text-gray-400 hover:text-red-500 text-xs leading-none"
                    @click="removeSkillItem(i)"
                  >
                    ×
                  </button>
                </div>
                <p
                  v-if="editingSkill.items.length === 0"
                  class="text-xs text-gray-400 italic self-center"
                >
                  No skills yet.
                </p>
              </div>
              <div class="flex gap-2">
                <UInput
                  v-model="newSkillItem"
                  size="sm"
                  placeholder="TypeScript, React… (comma-separate)"
                  class="flex-1"
                  @keydown.enter.prevent="addSkillItem"
                />
                <UButton
                  size="sm"
                  variant="soft"
                  icon="i-lucide-plus"
                  @click="addSkillItem"
                >
                  Add
                </UButton>
              </div>
            </div>
            <div
              class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800"
            >
              <UButton
                variant="ghost"
                color="neutral"
                @click="cancelSkill"
              >
                Cancel
              </UButton>
              <UButton
                :disabled="!editingSkill.category"
                @click="saveSkill"
              >
                Save
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </section>

    <USeparator />

    <!-- ── Languages ─────────────────────────────────────────────────────── -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2
          class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
        >
          Languages
        </h2>
        <UButton
          size="xs"
          icon="i-lucide-plus"
          @click="openLang()"
        >
          Add
        </UButton>
      </div>

      <div class="space-y-2">
        <div
          v-for="lang in store.resume.languages ?? []"
          :key="lang.id"
          class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5 bg-white dark:bg-gray-950"
        >
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ lang.name }}
            </p>
            <p class="text-xs text-gray-500">{{ lang.proficiency }}</p>
          </div>
          <div class="flex gap-1 shrink-0">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              @click="openLang(lang)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="red"
              icon="i-lucide-trash-2"
              @click="store.removeLanguage(lang.id)"
            />
          </div>
        </div>
        <p
          v-if="!(store.resume.languages ?? []).length"
          class="text-sm text-gray-400 italic"
        >
          No languages added yet.
        </p>
      </div>

      <UModal
        v-model:open="showLangModal"
        :ui="{ width: 'max-w-xs' }"
      >
        <template #content>
          <div
            v-if="editingLang"
            class="p-5 space-y-4"
          >
            <h3 class="font-semibold">Language</h3>
            <UFormField
              label="Language"
              required
            >
              <UInput
                v-model="editingLang.name"
                placeholder="English"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Proficiency">
              <USelect
                v-model="editingLang.proficiency"
                :items="PROFICIENCY_OPTIONS"
                class="w-full"
              />
            </UFormField>
            <div
              class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800"
            >
              <UButton
                variant="ghost"
                color="neutral"
                @click="cancelLang"
              >
                Cancel
              </UButton>
              <UButton
                :disabled="!editingLang.name"
                @click="saveLang"
              >
                Save
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </section>

    <USeparator />

    <!-- ── Backup ────────────────────────────────────────────────────────── -->
    <section class="space-y-3">
      <h2
        class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
      >
        Backup & Restore
      </h2>
      <p class="text-[11px] text-gray-400">
        Export your sites, applications, resume, and job board list to a JSON
        file — this data only lives in this browser's local storage, so it's
        worth keeping a copy. Does not include your Claude API key.
      </p>
      <div class="flex gap-2">
        <UButton
          size="xs"
          variant="soft"
          icon="i-lucide-download"
          @click="handleExport"
        >
          Export backup
        </UButton>
        <UButton
          size="xs"
          variant="soft"
          color="neutral"
          icon="i-lucide-upload"
          @click="fileInput?.click()"
        >
          Import backup
        </UButton>
        <input
          ref="fileInput"
          type="file"
          accept="application/json"
          class="hidden"
          @change="handleImport"
        />
      </div>
      <p
        v-if="backupMsg"
        class="text-xs"
        :class="
          backupError ? 'text-red-500' : 'text-green-600 dark:text-green-400'
        "
      >
        {{ backupMsg }}
      </p>
    </section>
  </div>
</template>
