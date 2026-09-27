/**
 * dsh-anydoc model-facing tools: convert_document_to_markdown and
 * detect_document_format, backed by the vendored anydoc engine.
 * @module dsh-anydoc/tools
 */

import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve, extname } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'

const WORKSPACE_NOTE =
  'All paths are resolved against the session workspace. Relative paths are anchored there; absolute paths are used as-is.'
const FORMAT_NOTE =
  'Explicit format name, one of: doc, docx, docm, ppt, pps, pot, pptx, pptm, ppsx, ppsm, xls, xlsx, xlsm, xlsb, odt, ods, odp, rtf, epub, pdf, csv. Omit to auto-detect from the file content.'

const renderJson = (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]

/** Resolve the caller workspace exactly like first-party fs tools. */
function sessionWorkspace(exec) {
  return exec.agent?.session.header.cwd ?? process.cwd()
}

/** Resolve a tool-supplied path against the session workspace. */
function resolvePath(exec, raw) {
  return isAbsolute(raw) ? raw : resolve(sessionWorkspace(exec), raw)
}

/** Wrap engine errors so the model sees a stable anydoc: prefix. */
function asAnyDocError(error) {
  const code = error?.code === undefined ? '' : ` [${String(error.code)}]`
  const message = typeof error?.message === 'string' ? error.message : String(error)
  return new Error(`anydoc: ${message}${code}`)
}

/**
 * Create the plugin's tool definitions bound to one loaded engine.
 * @param engine - the vendored NAPI binding.
 * @param options - optional plugin config ({ maxBytes }).
 * @returns an array of ToolDefinition.
 */
export function createAnyDocTools(engine, options = {}) {
  const maxBytes = options.maxBytes ?? 256 * 1024 * 1024

  const convertDocument = defineTool({
    name: 'convert_document_to_markdown',
    description:
      'Convert an office document, spreadsheet, presentation, ebook, or PDF to GitHub-Flavored Markdown. '
      + 'Supported inputs: Word (.doc/.docx/.docm), PowerPoint (.ppt/.pps/.pot/.pptx/.pptm/.ppsx/.ppsm), '
      + 'Excel (.xls/.xlsx/.xlsm/.xlsb), OpenDocument (.odt/.ods/.odp), RTF (.rtf), EPUB (.epub), CSV (.csv), PDF (.pdf). '
      + 'The format is detected from the file content; pass format only when detection cannot work (CSV, or a missing/wrong extension). '
      + 'Scanned/image-only PDFs fail as unsupported (anydoc does no OCR). '
      + 'For large documents pass output to write the Markdown to a file and return only the path. ' + WORKSPACE_NOTE,
    parameters: {
      file: { type: 'string', required: true, description: 'Path to the document to convert.' },
      format: { type: 'string', description: FORMAT_NOTE },
      output: { type: 'string', description: 'Optional output path to write the Markdown to; omit to return the Markdown inline.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          format: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          markdown: { type: 'string' },
          markdownLength: { type: 'integer' },
          outputPath: { type: 'string' },
        },
      },
      render: renderJson,
    },
    async execute(args, exec) {
      const target = resolvePath(exec, args.file)
      let bytes
      try {
        bytes = await readFile(target)
      } catch (error) {
        throw new Error(`anydoc: cannot read ${target}: ${error.message}`)
      }
      if (bytes.byteLength === 0) throw new Error('anydoc: the file is empty')
      if (bytes.byteLength > maxBytes) {
        throw new Error(`anydoc: file exceeds the ${maxBytes} byte limit`)
      }
      const detected = engine.formatFromBytes(bytes) ?? engine.formatFromExtension(extname(target).slice(1)) ?? null
      const format = args.format ?? detected ?? 'unknown'
      let markdown
      try {
        markdown = await engine.toMarkdownBytes(bytes, args.format ?? undefined)
      } catch (error) {
        throw asAnyDocError(error)
      }
      if (typeof args.output === 'string' && args.output.length > 0) {
        const out = resolvePath(exec, args.output)
        try {
          await writeFile(out, markdown, 'utf8')
        } catch (error) {
          throw new Error(`anydoc: cannot write ${out}: ${error.message}`)
        }
        return { path: target, format, bytes: bytes.byteLength, markdownLength: markdown.length, outputPath: out }
      }
      return { path: target, format, bytes: bytes.byteLength, markdown }
    },
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: `Convert ${String(args.file)}`,
      kind: 'execute',
      locations: [{ path: String(args.file) }],
    }),
  })

  const detectFormat = defineTool({
    name: 'detect_document_format',
    description:
      'Identify the document format of a file from its content (and extension fallback), without converting. '
      + 'Returns the detected format name, or null when nothing matches. ' + WORKSPACE_NOTE,
    parameters: {
      file: { type: 'string', required: true, description: 'Path to the file to inspect.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          format: { type: 'string' },
          extension: { type: 'string' },
        },
      },
      render: renderJson,
    },
    async execute(args, exec) {
      const target = resolvePath(exec, args.file)
      let bytes
      try {
        bytes = await readFile(target)
      } catch (error) {
        throw new Error(`anydoc: cannot read ${target}: ${error.message}`)
      }
      const extension = extname(target).slice(1)
      const format = engine.formatFromBytes(bytes) ?? engine.formatFromExtension(extension) ?? null
      return { path: target, format, extension }
    },
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: `Detect format ${String(args.file)}`,
      kind: 'read',
      locations: [{ path: String(args.file) }],
    }),
  })

  return [convertDocument, detectFormat]
}
