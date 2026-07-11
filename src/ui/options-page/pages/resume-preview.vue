<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useResumeStore } from 'src/stores/resume.store'
import { useApplicationsStore } from 'src/stores/applications.store'
import { sanitizeForAts } from 'src/utils/text'
import type { Resume } from 'src/types/resume'

const store = useResumeStore()
const appsStore = useApplicationsStore()
const route = useRoute()

const targetApp = computed(() => {
  const id = route.query.appId as string | undefined
  return id ? appsStore.applications.find(a => a.id === id) : undefined
})

const tailored = computed(() => targetApp.value?.tailoredResume)

function sanitizeResume(resume: Resume): Resume {
  return {
    ...resume,
    basics: {
      ...resume.basics,
      summary: resume.basics.summary ? sanitizeForAts(resume.basics.summary) : resume.basics.summary,
    },
    work: resume.work.map(job => ({
      ...job,
      highlights: job.highlights.map(sanitizeForAts),
    })),
    skills: resume.skills.map(group => ({
      ...group,
      items: group.items.map(sanitizeForAts),
    })),
  }
}

const r = computed((): Resume => {
  const base = store.resume as Resume
  const t = tailored.value

  const merged: Resume = t ? {
    ...base,
    basics: {
      ...base.basics,
      summary: t.summary || base.basics.summary,
    },
    work: base.work.map(job => {
      const tw = t.work.find(w => w.id === job.id)
      return tw && tw.highlights.length > 0 ? { ...job, highlights: tw.highlights } : job
    }),
    skills: base.skills.map(group => {
      const ts = t.skills?.find(s => s.id === group.id)
      return ts && ts.items.length > 0 ? { ...group, items: ts.items } : group
    }),
  } : base

  return sanitizeResume(merged)
})

function print() { window.print() }

const contactItems = computed(() => {
  const b = r.value.basics
  const items: { label: string; href?: string }[] = []
  if (b.location) items.push({ label: b.location })
  if (b.phone)    items.push({ label: b.phone, href: `tel:${b.phone}` })
  if (b.email)    items.push({ label: b.email, href: `mailto:${b.email}` })
  if (b.linkedin) items.push({ label: 'LinkedIn', href: b.linkedin })
  if (b.github)   items.push({ label: 'GitHub', href: b.github })
  if (b.website)  items.push({ label: b.website, href: b.website })
  return items
})
</script>

<template>
  <div class="preview-root">

    <!-- ── Toolbar (hidden on print) ────────────────── -->
    <div class="toolbar no-print">
      <button class="tb-btn" @click="$router.back()">← Back</button>
      <span class="tb-title">
        Resume Preview
        <span v-if="targetApp" class="tb-tailored-tag">
          ✨ Tailored for {{ targetApp.jobTitle }} @ {{ targetApp.company }}
        </span>
      </span>
      <button class="tb-btn tb-print" @click="print()">Print / Save as PDF</button>
    </div>

    <!-- ── Paper ────────────────────────────────────── -->
    <div class="page-wrap">
      <div class="resume">

        <!-- Header -->
        <header class="r-header">
          <h1 class="r-name">{{ r.basics.name }}</h1>
          <p v-if="r.basics.title" class="r-subtitle">{{ r.basics.title }}</p>
          <p class="r-contact">
            <template v-for="(item, i) in contactItems" :key="i">
              <span v-if="i > 0" class="dot"> · </span>
              <a v-if="item.href" :href="item.href" target="_blank">{{ item.label }}</a>
              <span v-else>{{ item.label }}</span>
            </template>
          </p>
        </header>

        <!-- Summary -->
        <section v-if="r.basics.summary?.trim()" class="r-section">
          <h2 class="r-sec-title">Summary</h2>
          <p class="r-summary">{{ r.basics.summary }}</p>
        </section>

        <!-- Work Experience -->
        <section v-if="r.work?.length" class="r-section">
          <h2 class="r-sec-title">Work Experience</h2>
          <div v-for="job in r.work" :key="job.id" class="entry">
            <div class="entry-row">
              <span class="entry-org">{{ job.company }}<span v-if="job.companyDescription" class="entry-org-desc"> — {{ job.companyDescription }}</span></span>
              <span v-if="job.location" class="entry-meta">{{ job.location }}</span>
            </div>
            <div class="entry-row">
              <span class="entry-role">{{ job.position }}</span>
              <span class="entry-meta">{{ job.startDate }} – {{ job.endDate || 'Present' }}</span>
            </div>
            <ul v-if="job.highlights?.length" class="bullets">
              <li v-for="(bullet, i) in job.highlights" :key="i">{{ bullet }}</li>
            </ul>
          </div>
        </section>

        <!-- Education -->
        <section v-if="r.education?.length" class="r-section">
          <h2 class="r-sec-title">Education</h2>
          <div v-for="edu in r.education" :key="edu.id" class="entry">
            <div class="entry-row">
              <span class="entry-org">{{ edu.institution }}</span>
              <span class="entry-meta">{{ edu.startDate }} – {{ edu.endDate || 'Present' }}</span>
            </div>
            <div class="entry-row">
              <span class="entry-role">{{ edu.degree }}{{ edu.field ? ` in ${edu.field}` : '' }}</span>
              <span v-if="edu.gpa" class="entry-meta">GPA {{ edu.gpa }}</span>
            </div>
          </div>
        </section>

        <!-- Skills -->
        <section v-if="r.skills?.length" class="r-section">
          <h2 class="r-sec-title">Skills</h2>
          <div v-for="group in r.skills" :key="group.id" class="skill-row">
            <span class="skill-cat">{{ group.category }}</span>
            <span class="skill-items">{{ group.items.join(' · ') }}</span>
          </div>
        </section>

        <!-- Languages -->
        <section v-if="(r.languages ?? []).length" class="r-section">
          <h2 class="r-sec-title">Languages</h2>
          <div class="lang-row">
            <span v-for="lang in (r.languages ?? [])" :key="lang.id" class="lang-item">
              {{ lang.name }} – {{ lang.proficiency }}
            </span>
          </div>
        </section>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ──────────────────────────────────────────── */
.preview-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #d6d6d6;
  overflow-y: auto;
  font-family: Arial, Helvetica, sans-serif;
}

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  background: #1e3a5f;
  color: white;
  font-size: 13px;
}

.tb-title {
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
}

.tb-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255,255,255,0.35);
  border-radius: 6px;
  background: rgba(255,255,255,0.1);
  color: white;
  cursor: pointer;
  font-size: 13px;
}

.tb-btn:hover { background: rgba(255,255,255,0.2); }
.tb-print { font-weight: 600; }

.tb-tailored-tag {
  display: inline-block;
  margin-left: 10px;
  padding: 2px 8px;
  background: rgba(255,255,255,0.15);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 400;
  opacity: 0.9;
}


/* ── Paper ───────────────────────────────────────────── */
.page-wrap {
  display: flex;
  justify-content: center;
  padding: 32px 16px 64px;
}

.resume {
  background: white;
  width: 210mm;
  min-height: 297mm;
  padding: 18mm 20mm;
  box-shadow: 0 2px 24px rgba(0,0,0,0.14);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #1a1a1a;
}

/* ── Header ──────────────────────────────────────────── */
.r-header {
  text-align: center;
  padding-bottom: 10px;
  margin-bottom: 14px;
  border-bottom: 2px solid #1e3a5f;
}

.r-name {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 22pt;
  font-weight: 700;
  color: #1e3a5f;
  margin: 0 0 4px;
  line-height: 1.15;
  letter-spacing: -0.2px;
}

.r-subtitle {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11pt;
  color: #555;
  margin: 0 0 6px;
}

.r-contact {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8.5pt;
  color: #444;
  margin: 0;
}

.r-contact a { color: #1e3a5f; text-decoration: none; }
.r-contact a:hover { text-decoration: underline; }
.dot { color: #aaa; }

/* ── Section wrapper ─────────────────────────────────── */
.r-section { margin-top: 20px; }

.r-sec-title {
  font-size: 10pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #1e3a5f;
  margin: 0 0 8px;
  padding-bottom: 4px;
  border-bottom: 1.5px solid #c8d5e5;
}

/* ── Summary ─────────────────────────────────────────── */
.r-summary {
  margin: 0;
  font-size: 10pt;
  line-height: 1.55;
  white-space: pre-line;
}

/* ── Work / Education entries ────────────────────────── */
.entry {
  margin-bottom: 10px;
  page-break-inside: avoid;
}

.entry-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.entry-org {
  font-weight: 700;
  font-size: 10.5pt;
}

.entry-org-desc {
  font-size: 9pt;
  font-weight: 400;
  font-style: italic;
  color: #666;
  font-family: Arial, Helvetica, sans-serif;
}

.entry-role {
  font-size: 10pt;
  color: #333;
}

.entry-meta {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9pt;
  color: #555;
  white-space: nowrap;
  flex-shrink: 0;
}

.bullets {
  margin: 4px 0 0;
  padding-left: 16px;
  font-size: 10pt;
  list-style: disc outside;
}

.bullets li {
  margin-bottom: 2px;
  line-height: 1.4;
}

/* ── Skills ──────────────────────────────────────────── */
.skill-row {
  display: flex;
  gap: 8px;
  font-size: 9.5pt;
  margin-bottom: 3px;
  line-height: 1.45;
}

.skill-cat {
  font-family: Arial, Helvetica, sans-serif;
  font-weight: 700;
  color: #1e3a5f;
  min-width: 130px;
  flex-shrink: 0;
}

.skill-items { color: #333; }

/* ── Languages ───────────────────────────────────────── */
.lang-row {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  font-size: 9.5pt;
}

.lang-item { color: #333; }

/* ── Print ───────────────────────────────────────────── */
@media print {
  .no-print { display: none !important; }

  .preview-root {
    position: static;
    background: white;
    overflow: visible;
  }

  .page-wrap {
    display: block;
    padding: 0;
  }

  .resume {
    box-shadow: none;
    width: 100%;
    min-height: unset;
    padding: 0;
  }

  @page {
    size: A4;
    margin: 18mm 20mm;
  }

  .r-contact a { color: #1e3a5f; }

  /* Individual job/edu blocks stay together, but sections CAN break between entries */
  .entry { page-break-inside: avoid; }

  /* Section title must never be orphaned alone at the bottom of a page */
  .r-sec-title { page-break-after: avoid; }
}
</style>
