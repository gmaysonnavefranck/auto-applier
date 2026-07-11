import type { FieldType, FieldMapping } from '../types/jobs'
import { ElementPicker } from './picker'
import { extractJob, readSelector } from './extractor'

// Element picker for field registration
let activePicker: ElementPicker | null = null

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'START_PICKER') {
    activePicker?.stop()
    activePicker = new ElementPicker(msg.field as FieldType, (selector, field) => {
      chrome.runtime.sendMessage({ type: 'FIELD_CAPTURED', selector, field })
      activePicker = null
    })
    activePicker.start()
    reply({ ok: true })
    return true
  }

  if (msg.type === 'STOP_PICKER') {
    activePicker?.stop()
    activePicker = null
    reply({ ok: true })
    return true
  }

  if (msg.type === 'TEST_SELECTOR') {
    try {
      const { count, text } = readSelector(msg.selector as string)
      reply({ ok: true, count, preview: text?.slice(0, 200) })
    } catch {
      reply({ ok: false, count: 0 })
    }
    return true
  }

  if (msg.type === 'EXTRACT_JOB') {
    const data = extractJob(msg.mappings as FieldMapping[])
    console.log('[auto-applier] extracted:', {
      source: data.source,
      jobTitle: data.jobTitle,
      company: data.company,
      descriptionLength: data.description?.length ?? 0,
      descriptionPreview: data.description?.slice(0, 100),
      jsonLdScripts: document.querySelectorAll('script[type="application/ld+json"]').length,
    })
    reply({ ok: true, data })
    return true
  }
})

