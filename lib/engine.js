/**
 * dsh-anydoc engine seam: loads the vendored N-API binary directly via Node's
 * CJS interop (createRequire). The binary is the compiled anydoc engine for
 * Windows x64 and exports toMarkdown / toMarkdownBytes / toDocument /
 * formatFromBytes / ... directly, so no generated NAPI-RS loader (CJS) is
 * shipped in this bundle — the whole plugin stays ESM.
 * @module dsh-anydoc/engine
 */

import { createRequire } from 'node:module'

if (process.platform !== 'win32') {
  throw new Error(
    `dsh-anydoc: this build only supports Windows x64 (running on ${process.platform}/${process.arch}). `
    + 'On other platforms, vendor the matching @firecrawl/anydoc-<platform>-<arch> binary '
    + 'into vendor/anydoc/ and extend engine.js.',
  )
}

const require = createRequire(import.meta.url)

/** Loaded NAPI binding: toMarkdown, toMarkdownBytes, toDocument, formatFromBytes, ... */
export const anydoc = require('../vendor/anydoc/anydoc.win32-x64-msvc.node')

/** Which vendored binary is in use (for diagnostics). */
export const ANYDOC_BINARY = 'anydoc.win32-x64-msvc.node'

/** Engine version, kept in sync with the vendored package. */
export const ANYDOC_VERSION = '0.2.3'
