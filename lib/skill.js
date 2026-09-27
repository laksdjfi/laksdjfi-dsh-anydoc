/**
 * dsh-anydoc skill: adapts the upstream anydoc Agent Skill to the DSH skill
 * registry. The content teaches agents to use the plugin's native tools
 * instead of the npx CLI (which needs a network install).
 * @module dsh-anydoc/skill
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ANYDOC_SKILL_NAME = 'convert-documents-to-markdown'

const SKILL_BASE = fileURLToPath(new URL('../assets/skill/', import.meta.url))

export const ANYDOC_SKILL_CONTENT = readFileSync(
  new URL('../assets/skill/SKILL.md', import.meta.url),
  'utf8',
)

export const ANYDOC_SKILL = {
  name: ANYDOC_SKILL_NAME,
  description:
    '把 Word（.doc/.docx/.docm）、PowerPoint、Excel、OpenDocument（.odt/.ods/.odp）、RTF、EPUB、CSV 和 PDF 文档转换为 GitHub 风格 Markdown。'
    + '当任务需要读取无法直接阅读的办公文档、电子表格、演示文稿、电子书或 PDF 的内容时使用。',
  whenToUse:
    '任务涉及读取办公文档、表格、幻灯片、电子书或 PDF 的内容，或需要把文档转为 Markdown 时使用。',
  source: 'runtime',
  resourceBase: { kind: 'directory', path: SKILL_BASE },
  content: ANYDOC_SKILL_CONTENT,
}
