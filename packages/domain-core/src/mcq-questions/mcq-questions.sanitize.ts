/**
 * MCQ Questions — Rich Text Sanitization
 *
 * File: packages/domain-core/src/mcq-questions/mcq-questions.sanitize.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Server-side HTML sanitization using whitelist approach (Research R-001).
 * Applied to: content, explanation (question), and content (option) fields.
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
