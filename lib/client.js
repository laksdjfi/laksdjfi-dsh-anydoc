/**
 * dsh-anydoc browser plugin: a document converter panel under Settings, plus
 * a result card for the convert_document_to_markdown tool.
 * Plain-JS bundle in the DSH client-module format (window.__ModuleLoader__).
 * @module dsh-anydoc/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-anydoc',
  factory: (require) => {
    'use strict'

    const React = require('react')
    const { useCallback, useEffect, useRef, useState } = React
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { Button, MarkdownText } = primitives

    const CONVERT_ROUTE = '/_dsh/anydoc/convert'
    const ACCEPTED = [
      '.doc', '.docx', '.docm',
      '.ppt', '.pps', '.pot', '.pptx', '.pptm', '.ppsx', '.ppsm',
      '.xls', '.xlsx', '.xlsm', '.xlsb',
      '.odt', '.ods', '.odp',
      '.rtf', '.epub', '.csv', '.pdf',
    ]
    const FORMATS = [
      '', 'doc', 'docx', 'docm', 'ppt', 'pptx', 'xls', 'xlsx',
      'odt', 'ods', 'odp', 'rtf', 'epub', 'csv', 'pdf',
    ]

    // Panel CSS: a persistent dashed drop zone plus drag-feedback animation.
    // Injected once, guarded by a data attribute (same pattern as DSH bundles).
    const ANYDOC_CSS_TAG = 'dsh-anydoc/panel'
    if (typeof document !== 'undefined' && !document.querySelector(`style[data-plugin-css="${ANYDOC_CSS_TAG}"]`)) {
      const tag = document.createElement('style')
      tag.dataset.pluginCss = ANYDOC_CSS_TAG
      tag.textContent = `
[data-anydoc-zone]{border:2px dashed #cbd5e1;border-radius:12px;padding:30px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;text-align:center;background:var(--dsw-alias-bg-1,#f8fafc);transition:border-color .15s ease,background-color .15s ease,box-shadow .15s ease}
[data-anydoc-zone]:hover,[data-anydoc-zone][data-active="true"]{border-color:#2563eb;background:var(--dsw-alias-bg-2,#eff6ff);box-shadow:0 0 0 3px rgba(37,99,235,.10)}
[data-anydoc-zone][data-active="true"]{border-style:solid}
[data-anydoc-zone] svg{color:#64748b;transition:color .15s ease,transform .15s ease}
[data-anydoc-zone]:hover svg,[data-anydoc-zone][data-active="true"] svg{color:#2563eb;transform:translateY(-2px)}
[data-anydoc-zone-title]{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#0f172a);margin-top:6px;word-break:break-all;max-width:100%}
[data-anydoc-zone-sub]{font-size:12px;color:var(--dsw-alias-label-tertiary,#64748b)}
[data-anydoc-zone-hint]{font-size:11px;color:var(--dsw-alias-label-tertiary,#94a3b8);margin-top:6px}
@keyframes anydocFadeIn{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}
@keyframes anydocBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
`
      document.head.appendChild(tag)
    }

    const styles = {
      panel: { fontFamily: 'inherit', maxWidth: '860px', position: 'relative' },
      row: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' },
      select: {
        padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
        background: '#fff', fontSize: '13px', color: '#0f172a',
      },
      button: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#0f172a' },
      primary: { background: '#2563eb', borderColor: '#2563eb', color: '#fff' },
      status: { fontSize: '13px', color: '#475569', margin: '0 0 12px' },
      error: { color: '#b91c1c', fontSize: '13px', margin: '0 0 12px', whiteSpace: 'pre-wrap' },
      tabs: { display: 'flex', gap: '6px', marginBottom: '8px' },
      tab: {
        padding: '5px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
        background: '#fff', cursor: 'pointer', fontSize: '12px', color: '#475569',
      },
      tabActive: { background: '#e2e8f0', color: '#0f172a' },
      pre: {
        background: '#0f172a', color: '#e2e8f0', padding: '14px', borderRadius: '8px',
        fontSize: '12px', lineHeight: '1.6', overflow: 'auto', maxHeight: '520px',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0',
      },
      meta: { fontSize: '12px', color: '#64748b', margin: '0 0 8px' },
      toolView: { padding: '4px 0' },
      toolHead: { fontSize: '13px', color: '#475569', marginBottom: '8px' },
      dropOverlay: {
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
        background: 'var(--dsw-alias-bg-mask-drop, rgba(239, 246, 255, 0.94))',
        border: '2px dashed #2563eb', borderRadius: '12px',
        pointerEvents: 'none',
        backdropFilter: 'blur(2px)',
        animation: 'anydocFadeIn 0.18s ease-out',
      },
      dropOverlayIcon: { color: '#2563eb', animation: 'anydocBounce 1s ease-in-out infinite' },
      dropOverlayTitle: { fontSize: '17px', fontWeight: 700, color: '#2563eb' },
      dropOverlaySub: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, #64748b)' },
    }

    function formatBytes(n) {
      if (n < 1024) return `${n} B`
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
      return `${(n / (1024 * 1024)).toFixed(1)} MB`
    }

    /** Upload-arrow icon (inline SVG, inherits currentColor). */
    function UploadIcon({ size = 32, style }) {
      return React.createElement('svg', {
        viewBox: '0 0 24 24', width: size, height: size,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        style, 'aria-hidden': true,
      },
        React.createElement('path', { d: 'M12 16V4' }),
        React.createElement('path', { d: 'm6 9 6-5 6 5' }),
        React.createElement('path', { d: 'M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2' }),
      )
    }

    /** Decode the canonical tool result: block.meta first, JSON text fallback. */
    function decodeResult(block) {
      if (!block || block.isError) return undefined
      if (block.meta && typeof block.meta === 'object' && block.meta !== null) return block.meta
      const text = (block.content ?? [])
        .filter((entry) => entry && entry.type === 'text')
        .map((entry) => entry.text)
        .join('\n')
        .trim()
      if (text.length === 0) return undefined
      try {
        const parsed = JSON.parse(text)
        return parsed && typeof parsed === 'object' ? parsed : undefined
      } catch {
        return undefined
      }
    }

    /** The Settings-section converter panel: pick, convert, preview. */
    function ConvertPanel() {
      const [file, setFile] = useState(null)
      const [format, setFormat] = useState('')
      const [status, setStatus] = useState('idle') // idle | busy | done | error
      const [message, setMessage] = useState('')
      const [result, setResult] = useState(null)
      const [tab, setTab] = useState('preview')
      const [copied, setCopied] = useState(false)
      const inputRef = useRef(null)
      const panelRef = useRef(null)
      const [dragActive, setDragActive] = useState(false)
      const dragDepth = useRef(0)
      const statusRef = useRef(status)
      const pickRef = useRef(null)

      useEffect(() => { statusRef.current = status }, [status])

      const pick = useCallback((candidate) => {
        if (!candidate) return
        setFile(candidate)
        setResult(null)
        setStatus('idle')
        setMessage('')
        setTab('preview')
      }, [])

      useEffect(() => { pickRef.current = pick }, [pick])

      // DSH Web registers *document-level* drag listeners (the chat
      // composer's attachment overlay and the workspace drop target) that
      // claim any file dragged anywhere in the app with a full-screen
      // overlay. Intercept drag events in the capture phase while the
      // pointer is over this panel, so those global listeners never see
      // them and the file lands here instead.
      useEffect(() => {
        const hasFiles = (event) => {
          const types = event.dataTransfer && event.dataTransfer.types
          return Array.isArray(types) ? types.includes('Files') : false
        }
        const overPanel = (event) => {
          const node = panelRef.current
          return node !== null && node.contains(event.target)
        }
        const onDragEnter = (event) => {
          if (!hasFiles(event) || !overPanel(event)) return
          event.preventDefault()
          event.stopImmediatePropagation()
          dragDepth.current += 1
          setDragActive(true)
        }
        const onDragOver = (event) => {
          if (!hasFiles(event) || !overPanel(event)) return
          event.preventDefault()
          event.stopImmediatePropagation()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
        }
        const onDragLeave = (event) => {
          if (!hasFiles(event) || !overPanel(event)) return
          event.preventDefault()
          event.stopImmediatePropagation()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragActive(false)
        }
        const onDrop = (event) => {
          if (!hasFiles(event) || !overPanel(event)) return
          event.preventDefault()
          event.stopImmediatePropagation()
          dragDepth.current = 0
          setDragActive(false)
          if (statusRef.current === 'busy') return
          const files = event.dataTransfer && event.dataTransfer.files
          if (files && files.length > 0) pickRef.current(files[0])
        }
        window.addEventListener('dragenter', onDragEnter, true)
        window.addEventListener('dragover', onDragOver, true)
        window.addEventListener('dragleave', onDragLeave, true)
        window.addEventListener('drop', onDrop, true)
        return () => {
          window.removeEventListener('dragenter', onDragEnter, true)
          window.removeEventListener('dragover', onDragOver, true)
          window.removeEventListener('dragleave', onDragLeave, true)
          window.removeEventListener('drop', onDrop, true)
        }
      }, [])

      const convert = useCallback(async () => {
        if (!file) return
        setStatus('busy')
        setMessage('')
        setResult(null)
        try {
          const params = new URLSearchParams()
          params.set('name', file.name)
          if (format) params.set('format', format)
          const response = await fetch(`${CONVERT_ROUTE}?${params.toString()}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/octet-stream' },
            body: file,
          })
          const body = await response.json()
          if (!response.ok || !body.ok) {
            throw new Error((body.error && body.error.message) || `HTTP ${response.status}`)
          }
          setResult(body.value)
          setTab('preview')
          setStatus('done')
        } catch (error) {
          setMessage(String((error && error.message) || error))
          setStatus('error')
        }
      }, [file, format])

      const copyMarkdown = useCallback(async () => {
        if (!result || typeof result.markdown !== 'string') return
        try {
          await navigator.clipboard.writeText(result.markdown)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard unavailable; ignore */
        }
      }, [result])

      const clearAll = useCallback(() => {
        setFile(null)
        setResult(null)
        setStatus('idle')
        setMessage('')
        setTab('preview')
      }, [])

      return React.createElement('div', {
        style: styles.panel,
        ref: panelRef,
      },
        React.createElement('div', {
          'data-anydoc-zone': '',
          'data-active': dragActive ? 'true' : 'false',
          role: 'button',
          tabIndex: 0,
          'aria-label': file ? `已选择 ${file.name}，点击更换文件` : '选择要转换的文档',
          onClick: () => { if (inputRef.current) inputRef.current.click() },
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              if (inputRef.current) inputRef.current.click()
            }
          },
        },
          React.createElement(UploadIcon, { size: 34 }),
          React.createElement('div', { 'data-anydoc-zone-title': '' }, file ? file.name : '把文件拖到这里'),
          React.createElement('div', { 'data-anydoc-zone-sub': '' }, file ? `${formatBytes(file.size)} · 点击或拖拽更换文件` : '或点击选择文件'),
          React.createElement('div', { 'data-anydoc-zone-hint': '' }, '支持 doc/docx/ppt/pptx/xls/xlsx/odt/ods/odp/rtf/epub/csv/pdf'),
        ),
        React.createElement('input', {
          ref: inputRef,
          type: 'file',
          accept: ACCEPTED.join(','),
          style: { display: 'none' },
          onChange: (event) => pick(event.target.files && event.target.files[0]),
        }),
        React.createElement('div', { style: styles.row },
          React.createElement('label', { style: { fontSize: '13px', color: '#475569' } }, '格式（可选，留空自动识别）'),
          React.createElement('select', {
            style: styles.select,
            value: format,
            onChange: (event) => setFormat(event.target.value),
          }, FORMATS.map((value) => React.createElement('option', { key: value, value }, value === '' ? '自动识别' : value))),
          React.createElement('button', { style: Object.assign({}, styles.button, styles.primary), disabled: !file || status === 'busy', onClick: convert }, status === 'busy' ? '转换中…' : '转换为 Markdown'),
          React.createElement('button', { style: styles.button, disabled: status === 'busy', onClick: clearAll }, '清空'),
        ),
        status === 'error'
          ? React.createElement('p', { style: styles.error }, message)
          : status === 'busy'
            ? React.createElement('p', { style: styles.status }, '正在转换…')
            : null,
        result && typeof result.markdown === 'string'
          ? React.createElement('div', null,
              React.createElement('p', { style: styles.meta },
                `格式：${result.format || '未知'} · 输入 ${formatBytes(result.bytes || 0)} · 输出 ${result.markdownLength} 字符`),
              React.createElement('div', { style: styles.tabs },
                React.createElement('button', { style: tab === 'preview' ? Object.assign({}, styles.tab, styles.tabActive) : styles.tab, onClick: () => setTab('preview') }, '预览'),
                React.createElement('button', { style: tab === 'source' ? Object.assign({}, styles.tab, styles.tabActive) : styles.tab, onClick: () => setTab('source') }, 'Markdown'),
                React.createElement('button', { style: styles.tab, onClick: copyMarkdown }, copied ? '已复制' : '复制'),
              ),
              tab === 'preview' && typeof MarkdownText === 'function'
                ? React.createElement(MarkdownText, { text: result.markdown })
                : React.createElement('pre', { style: styles.pre }, result.markdown),
            )
          : null,
        dragActive
          ? React.createElement('div', { style: styles.dropOverlay },
              React.createElement(UploadIcon, { size: 56, style: styles.dropOverlayIcon }),
              React.createElement('div', { style: styles.dropOverlayTitle }, '松开鼠标，导入文件'),
              React.createElement('div', { style: styles.dropOverlaySub }, '将选中第一个文件'),
            )
          : null,
      )
    }

    /** Tool-result card shown in conversation for convert_document_to_markdown. */
    function ConvertResultView({ block }) {
      const [copied, setCopied] = useState(false)
      const value = decodeResult(block)
      const markdown = value && typeof value.markdown === 'string' ? value.markdown : ''
      const format = value && typeof value.format === 'string' ? value.format : ''
      const outputPath = value && typeof value.outputPath === 'string' ? value.outputPath : undefined

      const copyMarkdown = useCallback(async () => {
        if (!markdown) return
        try {
          await navigator.clipboard.writeText(markdown)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard unavailable; ignore */
        }
      }, [markdown])

      return React.createElement('div', { style: styles.toolView },
        React.createElement('div', { style: styles.toolHead },
          `转换完成${format ? ` · ${format}` : ''}${outputPath ? ` · 已写入 ${outputPath}` : ''}`,
          markdown
            ? React.createElement('button', { style: Object.assign({}, styles.tab, { marginLeft: '8px' }), onClick: copyMarkdown }, copied ? '已复制' : '复制')
            : null,
        ),
        markdown
          ? (typeof MarkdownText === 'function'
              ? React.createElement(MarkdownText, { text: markdown })
              : React.createElement('pre', { style: styles.pre }, markdown))
          : React.createElement('p', { style: styles.meta }, '没有可显示的 Markdown 内容'),
      )
    }

    const inject = ['slots', 'locale', 'remote', 'conversation', 'sessions']

    function apply(ctx) {
      ctx.slots.inject('tool.call.toolview', function* () {
        yield ctx.slots.register({
          name: 'tool.call.toolview',
          key: 'convert_document_to_markdown',
          inject: () => ({}),
        }, ConvertResultView)
      })
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'anydoc',
        order: 40,
        label: () => 'Anydoc 文档转换',
        inject: () => ({}),
      }, ConvertPanel))
    }

    // DSH client-module contract: the factory receives only `require` and its
    // RETURN value is the module exports (see client-modules materialize).
    return { inject, apply }
  },
})
