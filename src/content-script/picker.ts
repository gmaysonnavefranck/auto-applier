import type { FieldType } from '../types/jobs'
import { FIELD_CONFIG } from '../types/jobs'
import { getStableSelector } from './selector'

export type PickerCallback = (selector: string, field: FieldType) => void

const HL_ID = 'aa-hl'
const TIP_ID = 'aa-tip'

export class ElementPicker {
  private field: FieldType
  private cb: PickerCallback
  private hl: HTMLElement
  private tip: HTMLElement

  constructor(field: FieldType, cb: PickerCallback) {
    this.field = field
    this.cb = cb
    this.hl = makeHighlight()
    this.tip = makeTooltip()
  }

  start() {
    document.body.append(this.hl, this.tip)
    document.body.style.cursor = 'crosshair'
    window.addEventListener('mousemove', this.onMove)
    window.addEventListener('click', this.onClick, true)
    window.addEventListener('keydown', this.onKeyDown)
  }

  stop() {
    this.hl.remove()
    this.tip.remove()
    document.body.style.cursor = ''
    window.removeEventListener('mousemove', this.onMove)
    window.removeEventListener('click', this.onClick, true)
    window.removeEventListener('keydown', this.onKeyDown)
  }

  private onMove = (e: MouseEvent) => {
    const target = targetAt(e)
    if (!target) return

    const r = target.getBoundingClientRect()

    // Outline the hovered element — fixed so it's never clipped by overflow
    Object.assign(this.hl.style, {
      top: `${r.top}px`,
      left: `${r.left}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    })

    // Show field label + selector + extracted text
    const sel = getStableSelector(target)
    const text = (target.textContent?.trim() ?? '').slice(0, 120)

    this.tip.innerHTML =
      `<div style="font-size:10px;opacity:.75;margin-bottom:2px;">` +
        `📍 <b>${escHtml(FIELD_CONFIG[this.field].label)}</b> &nbsp;·&nbsp; ` +
        `<code style="font-family:monospace;font-size:9px;">${escHtml(sel)}</code> &nbsp;·&nbsp; Esc to cancel` +
      `</div>` +
      `<div style="font-size:14px;font-weight:700;">` +
        (text ? escHtml(text) : '<span style="opacity:.5;font-style:italic;">empty</span>') +
      `</div>`

    // Position tooltip above element; flip below if not enough room
    const tipAbove = r.top > 70
    Object.assign(this.tip.style, {
      top: tipAbove ? `${r.top - 4}px` : `${r.bottom + 4}px`,
      transform: tipAbove ? 'translateY(-100%)' : 'none',
      left: `${Math.min(r.left, window.innerWidth - 440)}px`,
    })
  }

  private onClick = (e: MouseEvent) => {
    const target = targetAt(e)
    if (!target) return
    e.preventDefault()
    e.stopImmediatePropagation()
    this.stop()
    this.cb(getStableSelector(target), this.field)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.stop()
      chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED', field: this.field })
    }
  }
}

function targetAt(e: MouseEvent): Element | null {
  return (
    document
      .elementsFromPoint(e.clientX, e.clientY)
      .find(
        el =>
          el.id !== HL_ID &&
          el.id !== TIP_ID &&
          el !== document.body &&
          el !== document.documentElement,
      ) ?? null
  )
}

function makeHighlight(): HTMLElement {
  const el = document.createElement('div')
  el.id = HL_ID
  Object.assign(el.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2147483646',
    outline: '2px solid #2563eb',
    background: 'rgba(37,99,235,0.08)',
    borderRadius: '2px',
    transition: 'top .05s, left .05s, width .05s, height .05s',
  })
  return el
}

function makeTooltip(): HTMLElement {
  const el = document.createElement('div')
  el.id = TIP_ID
  Object.assign(el.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2147483647',
    background: '#1e3a5f',
    color: '#fff',
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    padding: '8px 14px',
    borderRadius: '6px',
    maxWidth: '420px',
    lineHeight: '1.4',
    boxShadow: '0 4px 16px rgba(0,0,0,.35)',
    wordBreak: 'break-word',
  })
  return el
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
