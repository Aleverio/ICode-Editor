import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export function extensionFor(filename: string) {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return html()
  if (filename.endsWith('.css')) return css()
  if (filename.endsWith('.json')) return json()
  if (filename.endsWith('.md') || filename.endsWith('.mdx')) return markdown()
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filename)) {
    return javascript({ jsx: true, typescript: /\.(ts|tsx)$/.test(filename) })
  }
  return []
}

const syntaxColors = HighlightStyle.define([
  { tag: tags.keyword, color: '#f18b72', fontWeight: '600' },
  { tag: tags.operator, color: '#c4c8ce' },
  { tag: tags.string, color: '#d8c7a1' },
  { tag: tags.number, color: '#a9c1d4' },
  { tag: tags.comment, color: '#7d838b', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#c5cbd2' },
  { tag: tags.typeName, color: '#d0d4d9' },
  { tag: tags.propertyName, color: '#d6dade' },
  { tag: tags.tagName, color: '#e09a8d' },
  { tag: tags.attributeName, color: '#b9c2cb' },
])

export const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', color: '#dce0e5', backgroundColor: '#101214' },
    '.cm-content': {
      caretColor: '#d1d5da',
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      lineHeight: '20.15px',
      padding: '18px 0 32px',
    },
    '.cm-line': { padding: '0 20px', lineHeight: '20.15px' },
    '.cm-content::after': {
      content: '""',
      display: 'block',
      width: '1px',
      height: 'var(--editor-virtual-space, 360px)',
      pointerEvents: 'none',
    },
    '.cm-gutters': {
      minWidth: '48px',
      color: '#737981',
      backgroundColor: '#101214',
      border: 'none',
      borderRight: '1px solid #2b3036',
      padding: '18px 8px 0 0',
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '12px',
      lineHeight: '20.15px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      boxSizing: 'border-box',
      minWidth: '48px',
      padding: '0 12px 0 6px',
      fontVariantNumeric: 'tabular-nums',
      textAlign: 'right',
      lineHeight: '20.15px',
    },
    '.cm-activeLine': { backgroundColor: '#191c20' },
    '.cm-activeLineGutter': { color: '#d1d5da', backgroundColor: '#191c20' },
    '.cm-cursor': { borderLeftColor: '#d1d5da' },
    '.cm-selectionBackground, ::selection': { backgroundColor: '#343b42 !important' },
    '.cm-focused .cm-matchingBracket': { color: '#e2e5e9', outline: '1px solid #646b74' },
    '.cm-searchMatch': { backgroundColor: '#424850' },
    '.cm-searchMatch-selected': { backgroundColor: '#626b75' },
  },
  { dark: true },
)

export const editorExtensions = [
  indentUnit.of('  '),
  EditorView.lineWrapping,
  syntaxHighlighting(syntaxColors),
]

export { css, html, indentUnit, javascript, json, markdown }