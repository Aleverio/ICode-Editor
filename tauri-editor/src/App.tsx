import { useEffect, useRef, useState, type FormEvent } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { findNext, findPrevious, SearchQuery, search, setSearchQuery } from '@codemirror/search'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import {
  Braces,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Code2,
  FileCode2,
  FileJson2,
  FilePlus2,
  FileText,
  FolderOpen,
  PanelLeft,
  Plus,
  Save,
  Search,
  X,
} from 'lucide-react'
import './App.css'

type WorkspaceFile = {
  name: string
  content: string
  path?: string
}

const storageKey = 'morrow.workspace.v1'

const starterFiles: WorkspaceFile[] = [
  {
    name: 'index.html',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#eff2e9" />
    <title>Fieldnotes</title>
    <link rel="stylesheet" href="src/styles.css" />
  </head>
  <body>
    <main class="page">
      <p class="eyebrow">A little room to think</p>
      <h1>Fieldnotes<span>.</span></h1>
      <p class="intro">Keep the good ideas. Let the rest pass through.</p>
      <form class="note-form" id="note-form">
        <input id="note-input" aria-label="A new note" placeholder="Something worth keeping…" />
        <button aria-label="Add note" type="submit">Add note <span>↗</span></button>
      </form>
      <ul class="notes" id="notes" aria-live="polite"></ul>
      <p class="footnote" id="note-count">A quiet place for unfinished thoughts.</p>
    </main>
    <script type="module" src="src/main.js"></script>
  </body>
</html>`,
  },
  {
    name: 'src/main.js',
    content: `const form = document.querySelector('#note-form')
const input = document.querySelector('#note-input')
const list = document.querySelector('#notes')
const count = document.querySelector('#note-count')

const notes = [
  'Make space for the first draft.',
  'Small things, noticed properly.',
]

function renderNotes() {
  list.replaceChildren()

  for (const [index, text] of notes.entries()) {
    const item = document.createElement('li')
    const number = document.createElement('span')
    const label = document.createElement('span')
    const remove = document.createElement('button')

    number.className = 'note-number'
    number.textContent = String(index + 1).padStart(2, '0')
    label.textContent = text
    remove.type = 'button'
    remove.setAttribute('aria-label', \`Remove note: \${text}\`)
    remove.textContent = '×'
    remove.addEventListener('click', () => {
      notes.splice(index, 1)
      renderNotes()
    })

    item.append(number, label, remove)
    list.append(item)
  }

  count.textContent = notes.length
    ? \`\${notes.length} thoughts, still becoming.\`
    : 'A quiet place for unfinished thoughts.'
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const value = input.value.trim()
  if (!value) return

  notes.unshift(value)
  input.value = ''
  renderNotes()
  input.focus()
})

renderNotes()`,
  },
  {
    name: 'src/styles.css',
    content: `:root {
  color: #202820;
  background: #eff2e9;
  font-family: "Space Grotesk", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background-image: linear-gradient(#dfe5d9 1px, transparent 1px);
  background-size: 100% 36px;
}

.page {
  width: min(100% - 40px, 620px);
  margin: 0 auto;
  padding: 88px 0 56px;
}

.eyebrow, .footnote { color: #69776b; font-size: 13px; }
.eyebrow { margin: 0 0 14px; }
h1 { margin: 0; font-size: clamp(48px, 12vw, 88px); line-height: .98; font-weight: 500; }
h1 span { color: #d95d45; }
.intro { margin: 18px 0 38px; color: #556158; }
.note-form { display: flex; gap: 10px; padding: 7px; background: #fff; border: 1px solid #d7ded2; }
.note-form input { min-width: 0; flex: 1; border: 0; padding: 10px; font: inherit; outline: none; }
.note-form button { border: 0; padding: 0 15px; background: #d9f16a; color: #202820; font: inherit; cursor: pointer; }
.note-form button span { margin-left: 8px; }
.notes { list-style: none; margin: 22px 0; padding: 0; }
.notes li { display: grid; grid-template-columns: 36px 1fr 32px; align-items: center; min-height: 54px; border-bottom: 1px solid #d7ded2; }
.note-number { color: #d95d45; font: 12px "IBM Plex Mono", monospace; }
.notes button { border: 0; background: transparent; color: #7c887e; font-size: 22px; cursor: pointer; }
.footnote { margin-top: 24px; font-family: "IBM Plex Mono", monospace; font-size: 11px; }`,
  },
  {
    name: 'README.md',
    content: `# Fieldnotes

A small, local-first notes experiment.

## Files

- \`index.html\` gives the page its structure.
- \`src/styles.css\` sets the paper-and-ink palette.
- \`src/main.js\` keeps note interactions intentionally simple.

Try adding a note, then remove one. The best tools leave room for the work.`,
  },
]

const syntaxColors = HighlightStyle.define([
  { tag: tags.keyword, color: '#f18b72', fontWeight: '600' },
  { tag: tags.operator, color: '#c8d98f' },
  { tag: tags.string, color: '#e6c875' },
  { tag: tags.number, color: '#94c9e4' },
  { tag: tags.comment, color: '#74847b', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#a9d9b2' },
  { tag: tags.typeName, color: '#8ed2c5' },
  { tag: tags.propertyName, color: '#d6e3d9' },
  { tag: tags.tagName, color: '#ef977e' },
  { tag: tags.attributeName, color: '#a9d9b2' },
])

const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', color: '#dce7df', backgroundColor: '#111a17' },
    '.cm-content': {
      caretColor: '#d9f16a',
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: '13px',
      padding: '18px 0 32px',
    },
    '.cm-line': { padding: '0 20px' },
    '.cm-gutters': {
      minWidth: '48px',
      color: '#64736b',
      backgroundColor: '#111a17',
      border: 'none',
      borderRight: '1px solid #26332d',
      paddingRight: '8px',
    },
    '.cm-activeLine': { backgroundColor: '#18231e' },
    '.cm-activeLineGutter': { color: '#d9f16a', backgroundColor: '#18231e' },
    '.cm-cursor': { borderLeftColor: '#d9f16a' },
    '.cm-selectionBackground, ::selection': { backgroundColor: '#344b3d !important' },
    '.cm-focused .cm-matchingBracket': { color: '#d9f16a', outline: '1px solid #536a43' },
    '.cm-searchMatch': { backgroundColor: '#586a36' },
    '.cm-searchMatch-selected': { backgroundColor: '#8b9e45' },
  },
  { dark: true },
)

function readWorkspace(): WorkspaceFile[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (
        Array.isArray(parsed) &&
        parsed.every((file) => typeof file?.name === 'string' && typeof file?.content === 'string')
      ) {
        return parsed as WorkspaceFile[]
      }
    }
  } catch {
    // Use the bundled example if local storage is unavailable.
  }
  return starterFiles
}

function extensionFor(filename: string) {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return html()
  if (filename.endsWith('.css')) return css()
  if (filename.endsWith('.json')) return json()
  if (filename.endsWith('.md') || filename.endsWith('.mdx')) return markdown()
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filename)) {
    return javascript({ jsx: true, typescript: /\.(ts|tsx)$/.test(filename) })
  }
  return []
}

function fileIcon(filename: string) {
  if (filename.endsWith('.json')) return FileJson2
  if (filename.endsWith('.md')) return FileText
  if (/\.(html|css|js|jsx|ts|tsx)$/.test(filename)) return FileCode2
  return Braces
}

function App() {
  const [files, setFiles] = useState(readWorkspace)
  const [savedVersions, setSavedVersions] = useState<Record<string, string>>(() =>
    Object.fromEntries(readWorkspace().map((file) => [file.name, file.content])),
  )
  const [activeName, setActiveName] = useState('index.html')
  const [tabs, setTabs] = useState(['index.html', 'src/main.js'])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newFileName, setNewFileName] = useState('src/untitled.ts')
  const [createError, setCreateError] = useState('')
  const [notice, setNotice] = useState('')
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const activeFile = files.find((file) => file.name === activeName) ?? files[0]
  const isDirty = activeFile ? activeFile.content !== savedVersions[activeFile.name] : false
  const language = activeFile?.name.split('.').pop()?.toUpperCase() ?? 'TEXT'

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(files))
    } catch (error) {
      console.warn('Workspace could not be saved locally.', error)
    }
  }, [files])

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveActiveFile()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        setDrawerOpen(true)
      }
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        setCreateOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function selectFile(name: string) {
    setActiveName(name)
    setTabs((current) => (current.includes(name) ? current : [...current, name]))
    setDrawerOpen(false)
  }

  function updateContent(value: string) {
    if (!activeFile) return
    setFiles((current) => current.map((file) =>
      file.name === activeFile.name ? { ...file, content: value } : file,
    ))
  }

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2200)
  }

  async function saveActiveFile() {
    if (!activeFile) return
    try {
      if (isTauri()) {
        const path = activeFile.path ?? await save({
          defaultPath: activeFile.name,
          filters: [{ name: 'Code files', extensions: ['html', 'css', 'js', 'ts', 'json', 'md', 'txt'] }],
        })
        if (!path) return
        await writeTextFile(path, activeFile.content)
        setFiles((current) => current.map((file) =>
          file.name === activeFile.name ? { ...file, path } : file,
        ))
      } else {
        const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = activeFile.name.split('/').pop() ?? 'untitled.txt'
        link.click()
        URL.revokeObjectURL(url)
      }
      setSavedVersions((current) => ({ ...current, [activeFile.name]: activeFile.content }))
      showNotice('File saved')
    } catch {
      showNotice('Could not save this file')
    }
  }

  async function openFile() {
    if (isTauri()) {
      try {
        const selection = await open({
          multiple: false,
          directory: false,
          filters: [{ name: 'Code files', extensions: ['html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'md', 'txt', 'rs', 'py'] }],
        })
        if (typeof selection !== 'string') return
        addOpenedFile(selection, await readTextFile(selection))
        return
      } catch {
        fileInput.current?.click()
        return
      }
    }
    fileInput.current?.click()
  }

  function addOpenedFile(path: string, content: string) {
    const name = path.split(/[\\/]/).pop() || 'opened-file.txt'
    setFiles((current) => current.some((file) => file.name === name)
      ? current.map((file) => file.name === name ? { ...file, content, path } : file)
      : [...current, { name, content, path }],
    )
    setSavedVersions((current) => ({ ...current, [name]: content }))
    selectFile(name)
    showNotice(`Opened ${name}`)
  }

  async function importBrowserFile(file?: File) {
    if (!file) return
    addOpenedFile(file.name, await file.text())
    if (fileInput.current) fileInput.current.value = ''
  }

  function createFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newFileName.trim().replace(/^\/+/, '')
    if (!name) return
    if (files.some((file) => file.name === name)) {
      setCreateError('A file with that name already exists.')
      return
    }
    setFiles((current) => [...current, { name, content: '' }])
    setSavedVersions((current) => ({ ...current, [name]: '' }))
    setActiveName(name)
    setTabs((current) => [...current, name])
    setCreateOpen(false)
    setCreateError('')
    setNewFileName('src/untitled.ts')
  }

  function closeTab(name: string) {
    const nextTabs = tabs.filter((tab) => tab !== name)
    setTabs(nextTabs)
    if (activeName === name) {
      const nextName = nextTabs[nextTabs.length - 1] ?? files.find((file) => file.name !== name)?.name
      if (nextName) setActiveName(nextName)
    }
  }

  function changeSearch(value: string) {
    setSearchTerm(value)
    if (!editorView) return
    editorView.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: value })) })
    if (value) findNext(editorView)
  }

  function insertAtCursor(value: string, cursorOffset: number) {
    if (!editorView) return
    const { from, to } = editorView.state.selection.main
    editorView.dispatch({
      changes: { from, to, insert: value },
      selection: { anchor: from + cursorOffset },
    })
    editorView.focus()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Code2 size={17} strokeWidth={2.3} /></span>
          <span className="brand-name">morrow</span>
          <span className="brand-divider" />
          <span className="workspace-name">FIELDNOTES</span>
          <ChevronDown className="workspace-chevron" size={14} />
        </div>
        <nav className="top-actions" aria-label="Editor actions">
          <button className="icon-button" type="button" title="Find in file" aria-label="Find in file" onClick={() => setSearchOpen((open) => !open)}><Search size={17} /></button>
          <button className="icon-button" type="button" title="Open file" aria-label="Open file" onClick={() => void openFile()}><FolderOpen size={17} /></button>
          <button className={`save-button${isDirty ? ' is-dirty' : ''}`} type="button" onClick={() => void saveActiveFile()}><Save size={15} /><span>Save</span><kbd>⌘ S</kbd></button>
        </nav>
      </header>

      <main className="workspace-layout">
        <aside className={`sidebar${drawerOpen ? ' is-open' : ''}`} aria-label="Project files">
          <div className="sidebar-heading">
            <div><span className="eyebrow-label">WORKSPACE</span><h1>Fieldnotes</h1></div>
            <div className="sidebar-tools">
              <button className="small-icon-button" type="button" title="Open file" aria-label="Open file" onClick={() => void openFile()}><FolderOpen size={16} /></button>
              <button className="small-icon-button" type="button" title="New file" aria-label="New file" onClick={() => setCreateOpen(true)}><FilePlus2 size={16} /></button>
            </div>
          </div>
          <div className="tree-label"><ChevronDown size={13} /><span>FIELDNOTES</span><span className="tree-count">{files.length}</span></div>
          <div className="file-list">
            {files.map((file) => {
              const Icon = fileIcon(file.name)
              return (
                <button className={`file-row${activeFile?.name === file.name ? ' is-active' : ''}`} key={file.name} type="button" onClick={() => selectFile(file.name)}>
                  <Icon size={15} strokeWidth={1.7} />
                  <span>{file.name}</span>
                  {file.content !== savedVersions[file.name] && <span className="dirty-dot" aria-label="Unsaved changes" />}
                </button>
              )
            })}
          </div>
          <div className="sidebar-foot"><span className="connection-dot" />LOCAL WORKSPACE</div>
        </aside>

        {drawerOpen && <button className="drawer-backdrop" type="button" aria-label="Close file list" onClick={() => setDrawerOpen(false)} />}

        <section className="editor-pane" aria-label="Code editor">
          <div className="editor-heading">
            <button className="mobile-menu icon-button" type="button" title="Show files" aria-label="Show files" onClick={() => setDrawerOpen(true)}><PanelLeft size={17} /></button>
            <div className="breadcrumbs"><span>fieldnotes</span><span className="crumb-slash">/</span><span>{activeFile?.name ?? 'No file'}</span></div>
            <div className="editor-heading-right"><span className="branch-indicator"><span />main</span><button className="heading-menu" type="button" title="More workspace actions" aria-label="More workspace actions"><span /><span /><span /></button></div>
          </div>

          <div className="tab-strip" role="tablist" aria-label="Open files">
            {tabs.filter((name) => files.some((file) => file.name === name)).map((name) => {
              const file = files.find((item) => item.name === name)
              const Icon = fileIcon(name)
              const dirty = file ? file.content !== savedVersions[name] : false
              return (
                <div className={`file-tab${activeName === name ? ' is-active' : ''}`} key={name} role="tab" aria-selected={activeName === name}>
                  <button type="button" onClick={() => selectFile(name)}><Icon size={14} /><span>{name.split('/').pop()}</span>{dirty && <span className="dirty-dot" />}</button>
                  <button className="tab-close" type="button" title={`Close ${name}`} aria-label={`Close ${name}`} onClick={() => closeTab(name)}><X size={13} /></button>
                </div>
              )
            })}
            <button className="tab-add" type="button" title="New file" aria-label="New file" onClick={() => setCreateOpen(true)}><Plus size={16} /></button>
          </div>

          {searchOpen && (
            <div className="search-row">
              <Search size={15} />
              <input
                ref={searchInput}
                value={searchTerm}
                onChange={(event) => changeSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && editorView) {
                    if (event.shiftKey) findPrevious(editorView)
                    else findNext(editorView)
                  }
                }}
                placeholder="Find in file"
                aria-label="Find in file"
              />
              <button type="button" title="Previous match" aria-label="Previous match" onClick={() => editorView && findPrevious(editorView)}><ChevronLeft size={16} /></button>
              <button type="button" title="Next match" aria-label="Next match" onClick={() => editorView && findNext(editorView)}><ChevronRight size={16} /></button>
              <button type="button" title="Close search" aria-label="Close search" onClick={() => { setSearchOpen(false); changeSearch('') }}><X size={15} /></button>
            </div>
          )}

          <div className="editor-frame">
            {activeFile ? (
              <CodeMirror
                value={activeFile.content}
                height="100%"
                theme={editorTheme}
                extensions={[extensionFor(activeFile.name), search(), indentUnit.of('  '), EditorView.lineWrapping, syntaxHighlighting(syntaxColors)]}
                onChange={updateContent}
                onCreateEditor={(view) => setEditorView(view)}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, highlightActiveLineGutter: true, bracketMatching: true, closeBrackets: true, autocompletion: true, tabSize: 2 }}
              />
            ) : <div className="empty-editor">Create a file to begin.</div>}
          </div>

          <div className="mobile-symbols" aria-label="Code symbols">
            {[
              { label: '()', value: '()', cursor: 1 },
              { label: '{}', value: '{}', cursor: 1 },
              { label: '[]', value: '[]', cursor: 1 },
              { label: '=>', value: ' => ', cursor: 4 },
              { label: ';', value: ';', cursor: 1 },
              { label: '"', value: '""', cursor: 1 },
              { label: "'", value: "''", cursor: 1 },
            ].map((symbol) => <button type="button" key={symbol.label} onClick={() => insertAtCursor(symbol.value, symbol.cursor)}>{symbol.label}</button>)}
          </div>

          <footer className="statusbar">
            <div className="status-left">
              <span className="status-live"><Circle size={8} fill="currentColor" /></span><span>Ready</span><span className="status-separator" />
              <span>{editorView ? `Ln ${editorView.state.doc.lineAt(editorView.state.selection.main.head).number}, Col ${editorView.state.selection.main.head - editorView.state.doc.lineAt(editorView.state.selection.main.head).from + 1}` : 'Ln 1, Col 1'}</span>
            </div>
            <div className="status-right"><span>Spaces: 2</span><span>UTF-8</span><span>{language}</span></div>
          </footer>
        </section>
      </main>

      <input ref={fileInput} className="visually-hidden" type="file" accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.md,.txt,.rs,.py" onChange={(event) => void importBrowserFile(event.target.files?.[0])} />

      {createOpen && (
        <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false) }}>
          <form className="create-dialog" onSubmit={createFile}>
            <div className="dialog-heading"><div><span className="eyebrow-label">FIELDNOTES</span><h2>New file</h2></div><button className="small-icon-button" type="button" aria-label="Close" onClick={() => setCreateOpen(false)}><X size={17} /></button></div>
            <label htmlFor="new-file-name">File path</label>
            <input id="new-file-name" autoFocus value={newFileName} onChange={(event) => { setNewFileName(event.target.value); setCreateError('') }} />
            {createError && <p className="form-error">{createError}</p>}
            <div className="dialog-actions"><button type="button" className="cancel-button" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="create-button"><Plus size={15} />Create file</button></div>
          </form>
        </div>
      )}

      {notice && <div className="notice" role="status"><Check size={15} />{notice}</div>}
    </div>
  )
}

export default App
