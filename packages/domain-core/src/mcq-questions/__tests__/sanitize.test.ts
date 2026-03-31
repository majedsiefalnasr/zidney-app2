/**
 * MCQ Questions — Sanitize Unit Tests
 *
 * File: packages/domain-core/src/mcq-questions/__tests__/sanitize.test.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL — T036
 *
 * Tests sanitizeRichText() covering XSS vector stripping, allowed tag preservation,
 * RTL dir attribute, and edge cases.
 */

import { describe, expect, it } from 'vitest'
import { sanitizeRichText } from '../mcq-questions.sanitize'

// ---------------------------------------------------------------------------
// Allowed tags & attributes
// ---------------------------------------------------------------------------

describe('sanitizeRichText — allowed tags', () => {
  it('preserves basic formatting tags (p, strong, em, u)', () => {
    const input = '<p><strong>Bold</strong> and <em>italic</em> and <u>underline</u></p>'
    expect(sanitizeRichText(input)).toBe(input)
  })

  it('preserves list tags (ol, ul, li)', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    expect(sanitizeRichText(input)).toBe(input)
  })

  it('preserves sub and sup tags', () => {
    const input = '<p>H<sub>2</sub>O and x<sup>2</sup></p>'
    expect(sanitizeRichText(input)).toBe(input)
  })

  it('preserves table structure', () => {
    const input =
      '<table><thead><tr><th>H1</th></tr></thead><tbody><tr><td>C1</td></tr></tbody></table>'
    expect(sanitizeRichText(input)).toBe(input)
  })

  it('preserves heading tags (h1-h4)', () => {
    const input = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3><h4>Sub-section</h4>'
    expect(sanitizeRichText(input)).toBe(input)
  })

  it('preserves blockquote, pre, code tags', () => {
    const input = '<blockquote>Quote</blockquote><pre><code>code</code></pre>'
    expect(sanitizeRichText(input)).toBe(input)
  })

  it('preserves img with allowed attributes (src, alt, width, height)', () => {
    const input = '<img src="https://example.com/img.png" alt="diagram" width="400" height="300" />'
    const result = sanitizeRichText(input)
    expect(result).toContain('src="https://example.com/img.png"')
    expect(result).toContain('alt="diagram"')
    expect(result).toContain('width="400"')
    expect(result).toContain('height="300"')
  })

  it('preserves data URI scheme for img', () => {
    const input = '<img src="data:image/png;base64,ABC123" alt="embedded" />'
    const result = sanitizeRichText(input)
    expect(result).toContain('data:image/png;base64,ABC123')
  })

  it('preserves RTL dir attribute on any element', () => {
    const input = '<p dir="rtl">Arabic content</p><span dir="ltr">English</span>'
    const result = sanitizeRichText(input)
    expect(result).toContain('dir="rtl"')
    expect(result).toContain('dir="ltr"')
  })

  it('preserves style and class on span and div', () => {
    const input =
      '<div class="math-block" style="text-align: center"><span class="highlight" style="color: red">text</span></div>'
    const result = sanitizeRichText(input)
    expect(result).toContain('class="math-block"')
    expect(result).toContain('class="highlight"')
  })

  it('preserves colspan and rowspan on td and th', () => {
    const input = '<table><tr><td colspan="2">Wide</td><th rowspan="3">Tall</th></tr></table>'
    const result = sanitizeRichText(input)
    expect(result).toContain('colspan="2"')
    expect(result).toContain('rowspan="3"')
  })
})

// ---------------------------------------------------------------------------
// XSS vector stripping
// ---------------------------------------------------------------------------

describe('sanitizeRichText — XSS prevention', () => {
  it('strips script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert')
    expect(result).toContain('<p>Hello</p>')
  })

  it('strips onerror event handlers on img', () => {
    const input = '<img src="x" onerror="alert(1)" />'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('alert')
  })

  it('strips onclick event handlers', () => {
    const input = '<p onclick="alert(1)">Click me</p>'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('onclick')
  })

  it('strips javascript: scheme in img src', () => {
    const input = '<img src="javascript:alert(1)" />'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('javascript:')
  })

  it('strips http: scheme from img src (only https and data allowed)', () => {
    const input = '<img src="http://evil.com/img.png" />'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('http://evil.com')
  })

  it('strips iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe>'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('<iframe')
  })

  it('strips form tags', () => {
    const input = '<form action="https://evil.com"><input type="text" /></form>'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('<form')
    expect(result).not.toContain('<input')
  })

  it('strips style tags (not inline style attribute)', () => {
    const input = '<style>body { display: none; }</style><p>visible</p>'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('<style')
    expect(result).toContain('<p>visible</p>')
  })

  it('strips object and embed tags', () => {
    const input = '<object data="malware.swf"></object><embed src="malware.swf" />'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('<object')
    expect(result).not.toContain('<embed')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('sanitizeRichText — edge cases', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeRichText('')).toBe('')
  })

  it('returns plain text when no HTML', () => {
    expect(sanitizeRichText('Plain text content')).toBe('Plain text content')
  })

  it('handles deeply nested allowed tags', () => {
    const input = '<div><ul><li><strong><em>Deep</em></strong></li></ul></div>'
    expect(sanitizeRichText(input)).toBe(input)
  })

  it('strips disallowed tags but preserves their text content', () => {
    const input = '<p>Hello <blink>World</blink></p>'
    const result = sanitizeRichText(input)
    expect(result).not.toContain('<blink')
    expect(result).toContain('World')
  })

  it('handles Arabic RTL content', () => {
    const input = '<p dir="rtl">ما هو ناتج ٢ + ٣؟</p>'
    const result = sanitizeRichText(input)
    expect(result).toContain('dir="rtl"')
    expect(result).toContain('ما هو ناتج')
  })
})
