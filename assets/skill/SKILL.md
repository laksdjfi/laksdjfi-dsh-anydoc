---
name: convert-documents-to-markdown
description: Convert Word (.doc, .docx, .docm), PowerPoint (.ppt, .pptx), Excel (.xls, .xlsx), OpenDocument (.odt, .ods, .odp), RTF, EPUB, CSV, and PDF files to GitHub-Flavored Markdown. Use when a task needs the contents of an office document, spreadsheet, presentation, ebook, or PDF you cannot read directly.
license: MIT
metadata:
  author: firecrawl
  maintainer: dsh-anydoc
---

# Convert documents to Markdown

Use the native `convert_document_to_markdown` tool provided by the dsh-anydoc plugin:

```text
convert_document_to_markdown(file=<path>)        # Markdown returned inline
convert_document_to_markdown(file=<path>, output=<path>)  # Markdown written to a file
convert_document_to_markdown(file=<path>, format=csv)     # explicit format, when detection cannot work
```

Rules:

1. Supported inputs: `.doc`, `.docx`, `.docm`, `.odt`, `.rtf`, `.epub`, `.pdf`, `.ppt`, `.pps`, `.pot`, `.pptx`, `.pptm`, `.ppsx`, `.ppsm`, `.odp`, `.xls`, `.xlsx`, `.xlsm`, `.xlsb`, `.ods`, `.csv`.
2. The format is detected from the file content. Pass `format` only when detection cannot work: CSV, or a missing or wrong extension.
3. On failure the tool returns an `anydoc: <message>` error. Error codes: `Unsupported` (unknown format, or an image-only PDF), `Encrypted` (password-protected), `Malformed` (no meaningful content), `ResourceLimit` (safety limit crossed), `MissingPart` (a required part is absent).
4. For a large document, write to a file with `output` and read the parts you need instead of streaming everything into context.
5. Scanned and image-only PDFs need OCR, which anydoc does not do; they fail as `Unsupported`. The hosted Firecrawl Parse API handles those.
6. Use `detect_document_format(file=<path>)` to identify an unknown file's format before converting.
