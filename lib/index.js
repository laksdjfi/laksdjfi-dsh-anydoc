/**
 * dsh-anydoc profile bundle: mounts the anydoc document converter into a DSH
 * profile. Registers two agent tools (convert_document_to_markdown,
 * detect_document_format), the convert-documents-to-markdown skill, and the
 * /_dsh/anydoc/* web routes used by the client panel.
 * @module dsh-anydoc
 */

import { anydoc, ANYDOC_VERSION } from './engine.js'
import { createAnyDocTools } from './tools.js'
import { ANYDOC_SKILL } from './skill.js'
import { installAnyDocWeb } from './web.js'

export const name = 'dsh-anydoc'

export const inject = ['tools', 'skills']

export function apply(ctx, config = {}) {
  const disposers = []
  try {
    const tools = createAnyDocTools(anydoc, config)
    for (const tool of tools) disposers.push(ctx.tools.register(tool))
    disposers.push(ctx.skills.register(ANYDOC_SKILL))
    installAnyDocWeb(ctx, anydoc)
    ctx.logger?.info?.('dsh-anydoc ready (engine %s)', ANYDOC_VERSION)
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}
