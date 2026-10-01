import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import type { Extension } from '@codemirror/state'

export function getLanguageExtensions(filename: string): Extension[] {
  const extension = filename.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'tsx':
    case 'ts':
      return [javascript({ typescript: true, jsx: true })]
    case 'jsx':
    case 'js':
    case 'mjs':
      return [javascript({ jsx: true })]
    case 'json':
      return [json()]
    case 'html':
    case 'htm':
      return [html()]
    case 'css':
      return [css()]
    case 'md':
    case 'markdown':
      return [markdown()]
    default:
      return []
  }
}
