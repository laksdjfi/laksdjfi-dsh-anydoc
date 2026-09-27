/**
 * dsh-anydoc optional Web routes: conversion, format detection, and health.
 * The browser posts raw document bytes to /_dsh/anydoc/convert and receives
 * the Markdown back as JSON. Routes are same-origin protected.
 * @module dsh-anydoc/web
 */

export const HEALTH_ROUTE = '/_dsh/anydoc/health'
export const CONVERT_ROUTE = '/_dsh/anydoc/convert'
export const DETECT_ROUTE = '/_dsh/anydoc/format'

const MAX_BODY_BYTES = 64 * 1024 * 1024

/** Same-origin guard: requests must come from the DSH Web application. */
function sameOrigin(req) {
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    const url = new URL(origin)
    return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function requestError(res, status, code, message) {
  json(res, status, { ok: false, error: { code, message } })
}

class BodyTooLargeError extends Error {}

/** Read the request body as a Buffer, rejecting past the byte limit. */
function readBody(req, limit) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new BodyTooLargeError(`body exceeds the ${limit} byte limit`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolvePromise(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function queryParams(req) {
  try {
    return new URL(req.url ?? '/', 'http://dsh.local').searchParams
  } catch {
    return new URLSearchParams()
  }
}

function handleHealth(_req, res, engine) {
  json(res, 200, {
    ok: true,
    value: {
      engine: 'anydoc',
      version: '0.2.3',
      routes: { health: HEALTH_ROUTE, convert: CONVERT_ROUTE, detect: DETECT_ROUTE },
    },
  })
}

async function handleConvert(req, res, engine) {
  try {
    if (req.method !== 'POST') {
      requestError(res, 405, 'method-not-allowed', 'Use POST')
      return
    }
    if (!sameOrigin(req)) {
      requestError(res, 403, 'origin-rejected', 'The request must originate from this DSH Web application')
      return
    }
    const params = queryParams(req)
    const explicit = params.get('format') ?? undefined
    const bytes = await readBody(req, MAX_BODY_BYTES)
    if (bytes.byteLength === 0) {
      requestError(res, 400, 'empty-body', 'No file bytes were uploaded')
      return
    }
    const detected = engine.formatFromBytes(bytes) ?? null
    const format = explicit ?? detected ?? 'unknown'
    let markdown
    try {
      markdown = await engine.toMarkdownBytes(bytes, explicit)
    } catch (error) {
      requestError(res, 422, String(error?.code ?? 'convert-failed'), error?.message ?? String(error))
      return
    }
    json(res, 200, {
      ok: true,
      value: {
        filename: params.get('name') ?? '',
        format,
        detected,
        bytes: bytes.byteLength,
        markdown,
        markdownLength: markdown.length,
      },
    })
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      requestError(res, 413, 'body-too-large', error.message)
      return
    }
    requestError(res, 500, 'convert-failed', error?.message ?? String(error))
  }
}

async function handleDetect(req, res, engine) {
  try {
    if (req.method !== 'POST') {
      requestError(res, 405, 'method-not-allowed', 'Use POST')
      return
    }
    if (!sameOrigin(req)) {
      requestError(res, 403, 'origin-rejected', 'The request must originate from this DSH Web application')
      return
    }
    const bytes = await readBody(req, MAX_BODY_BYTES)
    if (bytes.byteLength === 0) {
      requestError(res, 400, 'empty-body', 'No file bytes were uploaded')
      return
    }
    json(res, 200, { ok: true, value: { format: engine.formatFromBytes(bytes) ?? null } })
  } catch (error) {
    requestError(res, 500, 'detect-failed', error?.message ?? String(error))
  }
}

/**
 * Attach the web routes whenever a webServer service is present.
 * @param ctx - plugin context owning route effects.
 * @param engine - the vendored NAPI binding.
 */
export function installAnyDocWeb(ctx, engine) {
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const disposers = [
        webCtx.webServer.register({ kind: 'exact', path: HEALTH_ROUTE, handler: (req, res) => handleHealth(req, res, engine) }),
        webCtx.webServer.register({ kind: 'exact', path: CONVERT_ROUTE, handler: (req, res) => handleConvert(req, res, engine) }),
        webCtx.webServer.register({ kind: 'exact', path: DETECT_ROUTE, handler: (req, res) => handleDetect(req, res, engine) }),
      ]
      return () => {
        for (const dispose of disposers.reverse()) dispose()
      }
    }, 'dsh-anydoc: Web routes')
  })
}
