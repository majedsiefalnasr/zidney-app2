/**
 * Traditional Questions — Rich Text Sanitization
 *
 * File: packages/domain-core/src/traditional-questions/traditional-questions.sanitize.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Server-side HTML sanitization using whitelist approach.
 * Applied to: content field only.
 * correction_criteria is structured JSONB — validated by Zod, not sanitized as rich text.
 */

import sanitizeHtml from 'sanitize-html'

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    'ol',
    'ul',
    'li',
    'sub',
    'sup',
    'span',
    'div',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'h1',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'pre',
    'code',
  ],
  allowedAttributes: {
    img: ['src', 'alt', 'width', 'height'],
    span: ['style', 'class'],
    div: ['style', 'class'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    '*': ['dir'], // RTL/LTR support for Arabic content
  },
  allowedSchemes: ['https', 'data'],
  disallowedTagsMode: 'discard',
}

/** Sanitize rich-text HTML content using the project whitelist. */
export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, SANITIZE_OPTIONS)
}
