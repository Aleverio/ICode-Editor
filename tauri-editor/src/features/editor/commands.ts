import type { EditorCommand, EditorShortcut } from './types'

export function createEditorCommands(primaryKey: string): EditorCommand[] {
  const primary = (key: string, shift = false): EditorShortcut => ({ key, primary: true, shift })

  return [
    { id: 'save', label: 'Save active file', description: 'Write the current file to storage', keywords: 'save write disk', shortcut: `${primaryKey} S`, shortcuts: [primary('s')] },
    { id: 'open-workspace', label: 'Open folder or files', description: 'Open a project folder on desktop or import files on mobile', keywords: 'open folder project workspace import files', shortcut: `${primaryKey} O`, shortcuts: [primary('o')] },
    { id: 'find', label: 'Find in file', description: 'Search the active document', keywords: 'search find match', shortcut: `${primaryKey} F`, shortcuts: [primary('f')] },
    { id: 'new-file', label: 'Create new file', description: 'Add a file to this workspace', keywords: 'new create file', shortcut: `${primaryKey} N`, shortcuts: [primary('n')] },
    { id: 'toggle-explorer', label: 'Toggle file explorer', description: 'Show or hide workspace files', keywords: 'sidebar explorer files', shortcut: `${primaryKey} B`, shortcuts: [primary('b'), primary('p')] },
    { id: 'toggle-terminal', label: 'Toggle Morrow Shell', description: 'Open the virtual workspace terminal', keywords: 'terminal shell console', shortcut: `${primaryKey} J`, shortcuts: [primary('j')] },
    { id: 'close-tab', label: 'Close active tab', description: 'Close the current editor tab', keywords: 'close tab editor', shortcut: `${primaryKey} W`, shortcuts: [primary('w')] },
    { id: 'command-palette', label: 'Show command palette', description: 'Search and run an editor command', keywords: 'command palette actions', shortcut: `${primaryKey} Shift P`, shortcuts: [primary('p', true)] },
  ]
}

export function matchesShortcut(event: KeyboardEvent, shortcut: EditorShortcut) {
  const hasPrimary = event.metaKey || event.ctrlKey
  return event.key.toLowerCase() === shortcut.key
    && hasPrimary === Boolean(shortcut.primary)
    && event.shiftKey === Boolean(shortcut.shift)
}