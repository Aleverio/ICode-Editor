import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { join } from '@tauri-apps/api/path'
import { findNext, findPrevious, SearchQuery, search, setSearchQuery } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import { isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { CommandPalette } from './features/editor/CommandPalette'
import { createEditorCommands, matchesShortcut } from './features/editor/commands'
import { editorExtensions, editorTheme, extensionFor } from './features/editor/codeMirror'
import { fileIcon, fileLabel, filenameFromPath, readWorkspace, storageKey } from './features/editor/workspace'
import type { StarterWorkspaceFile, WorkspaceFile } from './features/editor/types'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Command,
  Code2,
  FilePlus2,
  FolderOpen,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Save,
  Search,
  Terminal,
  X,
} from 'lucide-react'
import './App.css'

const TerminalPanel = lazy(() => import('./features/terminal/TerminalPanel').then((module) => ({ default: module.TerminalPanel })))
const workspaceNameStorageKey = 'morrow.workspace.name.v1'

const starterFiles: StarterWorkspaceFile[] = [
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

const textExtensions = new Set([
  '.c', '.cc', '.conf', '.cpp', '.cs', '.css', '.dart', '.diff', '.go', '.gradle', '.h', '.hpp',
  '.html', '.htm', '.ini', '.java', '.js', '.jsx', '.json', '.kt', '.kts', '.lua', '.md', '.mdx',
  '.mk', '.mjs', '.patch', '.php', '.pl', '.properties', '.py', '.r', '.rb', '.rs', '.sh', '.sql',
  '.swift', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
])
const textFileNames = new Set([
  '.dockerignore', '.editorconfig', '.env.example', '.gitattributes', '.gitignore', '.npmrc',
  '.nvmrc', '.prettierignore', '.prettierrc', '.yarnrc', 'dockerfile', 'license', 'makefile', 'notice',
])
const ignoredDirectories = new Set([
  '.git', '.svn', '.next', '.expo', '.venv', 'build', 'dist', 'node_modules', 'Pods', 'target', 'venv',
])
function folderNameFromPath(path: string) {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || 'Workspace'
}

function isSupportedTextFile(name: string) {
  if (textFileNames.has(name.toLowerCase())) return true
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase()
  return textExtensions.has(extension)
}

function readWorkspaceName() {
  try {
    return localStorage.getItem(workspaceNameStorageKey) || 'Fieldnotes'
  } catch {
    return 'Fieldnotes'
  }
}

function App() {
  const [files, setFiles] = useState(() => readWorkspace(starterFiles))
  const [savedVersions, setSavedVersions] = useState<Record<string, string>>(() =>
    Object.fromEntries(files.map((file) => [file.id, file.content])),
  )
  const [activeId, setActiveId] = useState(() => {
    return files.find((file) => file.name === 'index.html')?.id ?? files[0]?.id ?? ''
  })
  const [tabs, setTabs] = useState(() => {
    const initialTabs = files
      .filter((file) => file.name === 'index.html' || file.name === 'src/main.js')
      .map((file) => file.id)
    return initialTabs.length ? initialTabs : files.slice(0, 1).map((file) => file.id)
  })
  const [workspaceName, setWorkspaceName] = useState(readWorkspaceName)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newFileName, setNewFileName] = useState('src/untitled.ts')
  const [createError, setCreateError] = useState('')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const searchInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  const activeFile = files.find((file) => file.id === activeId)
  const isDirty = activeFile ? activeFile.content !== savedVersions[activeFile.id] : false
  const language = activeFile?.name.split('.').pop()?.toUpperCase() ?? 'TEXT'
  const isMobilePlatform = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const workspaceOpenLabel = isMobilePlatform ? 'Open files' : 'Open folder'
  const documentLineCount = activeFile?.content.split('\n').length ?? 1
  const editorVirtualSpace = Math.round(Math.min(900, Math.max(220, window.innerHeight * 0.3) + documentLineCount * 3))
  const saveShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ S' : 'Ctrl S'
  const primaryKey = saveShortcut.startsWith('⌘') ? '⌘' : 'Ctrl'

  const commands = createEditorCommands(primaryKey)
  const editorLanguageExtensions = useMemo(() => [
    extensionFor(activeFile?.name ?? ''),
    search(),
    ...editorExtensions,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.selectionSet) return
      const position = update.state.selection.main.head
      const line = update.state.doc.lineAt(position)
      setCursorPosition({ line: line.number, column: position - line.from + 1 })
    }),
  ], [activeFile?.name])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(files))
    } catch (error) {
      console.warn('Workspace could not be saved locally.', error)
    }
  }, [files])

  useEffect(() => {
    try {
      localStorage.setItem(workspaceNameStorageKey, workspaceName)
    } catch (error) {
      console.warn('Workspace name could not be saved locally.', error)
    }
  }, [workspaceName])

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
  }, [])

  useEffect(() => {
    if (!actionsMenuOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!actionsMenuRef.current?.contains(event.target as Node)) setActionsMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionsMenuOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [actionsMenuOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        setCreateOpen(false)
        setSearchOpen(false)
        setCommandPaletteOpen(false)
        return
      }
      const command = commands.find((item) => item.shortcuts?.some((shortcut) => matchesShortcut(event, shortcut)))
      if (!command) return
      event.preventDefault()
      runCommand(command.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function selectFile(id: string) {
    setActiveId(id)
    setTabs((current) => (current.includes(id) ? current : [...current, id]))
    setDrawerOpen(false)
  }

  function updateContent(value: string) {
    if (!activeFile) return
    setFiles((current) => current.map((file) =>
      file.id === activeFile.id ? { ...file, content: value } : file,
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
          file.id === activeFile.id ? { ...file, path } : file,
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
      setSavedVersions((current) => ({ ...current, [activeFile.id]: activeFile.content }))
      showNotice('File saved')
    } catch {
      showNotice('Could not save this file')
    }
  }

  function replaceWorkspace(openedFiles: WorkspaceFile[], name: string) {
    const hasUnsavedChanges = files.some((file) => file.content !== savedVersions[file.id])
    if (hasUnsavedChanges && !window.confirm('Discard unsaved changes and open another project?')) return

    setFiles(openedFiles)
    setSavedVersions(Object.fromEntries(openedFiles.map((file) => [file.id, file.content])))
    setTabs(openedFiles[0] ? [openedFiles[0].id] : [])
    setActiveId(openedFiles[0]?.id ?? '')
    setWorkspaceName(name)
    setDrawerOpen(false)
    showNotice(openedFiles.length ? `Opened ${name} (${openedFiles.length} files)` : `${name} has no supported text files`)
  }

  async function readProjectFolder(rootPath: string) {
    const openedFiles: WorkspaceFile[] = []

    async function visit(directoryPath: string, relativeDirectory: string): Promise<void> {
      const entries = await readDir(directoryPath)

      for (const entry of entries) {
        const relativeName = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
        const fullPath = await join(directoryPath, entry.name)

        if (entry.isSymlink) continue
        if (entry.isDirectory) {
          if (!ignoredDirectories.has(entry.name)) {
            await visit(fullPath, relativeName)
          }
          continue
        }

        if (!entry.isFile || !isSupportedTextFile(entry.name)) continue
        const content = await readTextFile(fullPath)
        openedFiles.push({
          id: `path:${fullPath.replaceAll('\\', '/')}`,
          name: relativeName,
          content,
          path: fullPath,
        })
      }
    }

    await visit(rootPath, '')
    return openedFiles.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
  }

  async function openWorkspace() {
    if (isTauri() && !isMobilePlatform) {
      try {
        const selection = await open({
          multiple: false,
          directory: true,
        })
        if (!selection) return
        const rootPath = Array.isArray(selection) ? selection[0] : selection
        if (!rootPath) return
        replaceWorkspace(await readProjectFolder(rootPath), folderNameFromPath(rootPath))
        return
      } catch (error) {
        console.error('Could not read the selected project folder.', error)
        showNotice('Could not open this folder. Check folder access and try again.')
        return
      }
    }

    if (isTauri()) {
      try {
        const selection = await open({
          multiple: true,
          directory: false,
          filters: [{ name: 'Code files', extensions: ['html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'md', 'txt', 'rs', 'py'] }],
        })
        if (!selection) return
        const paths = Array.isArray(selection) ? selection : [selection]
        const selectedFiles = await Promise.all(paths.map(async (path) => ({
          path,
          content: await readTextFile(path),
        })))
        selectedFiles.forEach(({ path, content }) => addOpenedFile(path, content))
        return
      } catch {
        fileInput.current?.click()
        return
      }
    }

    if (isMobilePlatform) fileInput.current?.click()
    else folderInput.current?.click()
  }

  function addOpenedFile(path: string, content: string, keepDistinct = false) {
    const name = filenameFromPath(path)
    const existingFile = keepDistinct ? undefined : files.find((file) => file.path === path)
    const id = existingFile?.id ?? crypto.randomUUID()
    setFiles((current) => existingFile
      ? current.map((file) => file.id === id ? { ...file, content, path } : file)
      : [...current, { id, name, content, ...(keepDistinct ? {} : { path }) }],
    )
    setSavedVersions((current) => ({ ...current, [id]: content }))
    selectFile(id)
    showNotice(`Opened ${name}`)
  }

  async function importBrowserFiles(fileList?: FileList | null, isFolder = false) {
    if (!fileList?.length) return
    const selectedFiles = await Promise.all(Array.from(fileList, async (file) => ({
      name: file.webkitRelativePath || file.name,
      content: await file.text(),
    })))
    if (isFolder) {
      const folderName = selectedFiles[0]?.name.split('/')[0] || 'Workspace'
      const openedFiles = selectedFiles.map(({ name, content }) => {
        const relativeName = name.includes('/') ? name.slice(name.indexOf('/') + 1) : name
        return { id: crypto.randomUUID(), name: relativeName, content }
      })
      replaceWorkspace(openedFiles, folderName)
    } else {
      selectedFiles.forEach(({ name, content }) => addOpenedFile(name, content, true))
    }
    if (fileInput.current) fileInput.current.value = ''
    if (folderInput.current) folderInput.current.value = ''
  }

  function createFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newFileName.trim().replace(/^\/+/, '')
    if (!name) return
    if (files.some((file) => file.name === name)) {
      setCreateError('A file with that name already exists.')
      return
    }
    const id = crypto.randomUUID()
    setFiles((current) => [...current, { id, name, content: '' }])
    setSavedVersions((current) => ({ ...current, [id]: '' }))
    setActiveId(id)
    setTabs((current) => [...current, id])
    setCreateOpen(false)
    setCreateError('')
    setNewFileName('src/untitled.ts')
  }

  function closeTab(id: string) {
    const nextTabs = tabs.filter((tab) => tab !== id)
    setTabs(nextTabs)
    if (activeId === id) {
      setActiveId(nextTabs[nextTabs.length - 1] ?? '')
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

  function writeShellFile(name: string, content: string): string | undefined {
    const file = files.find((item) => item.name === name)
    if (file) {
      setFiles((current) => current.map((item) => item.id === file.id ? { ...item, content } : item))
      return
    }

    const id = crypto.randomUUID()
    setFiles((current) => [...current, { id, name, content }])
    setSavedVersions((current) => ({ ...current, [id]: '' }))
  }

  function runCommand(commandId: string) {
    switch (commandId) {
      case 'save':
        void saveActiveFile()
        break
      case 'open-workspace':
        void openWorkspace()
        break
      case 'find':
        setSearchOpen(true)
        break
      case 'new-file':
        setCreateOpen(true)
        break
      case 'toggle-explorer':
        setDrawerOpen((open) => !open)
        break
      case 'toggle-terminal':
        setTerminalOpen((open) => !open)
        break
      case 'close-tab':
        if (activeId) closeTab(activeId)
        break
      case 'command-palette':
        setCommandPaletteOpen(true)
        break
    }
  }

  return (
    <div className={`app-shell${terminalOpen ? ' has-terminal' : ''}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Code2 size={17} strokeWidth={2.3} /></span>
          <span className="brand-name">morrow</span>
          <span className="brand-divider" />
          <span className="workspace-name">{workspaceName.toUpperCase()}</span>
        </div>
        <nav className="top-actions" aria-label="Editor actions">
          <button className="icon-button" type="button" title="Find in file" aria-label="Find in file" onClick={() => setSearchOpen((open) => !open)}><Search size={17} /></button>
          <button className="icon-button" type="button" title={workspaceOpenLabel} aria-label={workspaceOpenLabel} onClick={() => void openWorkspace()}><FolderOpen size={17} /></button>
          <div className="actions-menu-anchor" ref={actionsMenuRef}>
            <button
              className={`icon-button actions-menu-trigger${actionsMenuOpen ? ' is-active' : ''}`}
              type="button"
              title="More actions"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={actionsMenuOpen}
              onClick={() => setActionsMenuOpen((open) => !open)}
            ><MoreHorizontal size={19} /></button>
            {actionsMenuOpen && (
              <div className="actions-menu" role="menu" aria-label="Editor actions">
                <button className="actions-menu-item" type="button" role="menuitem" onClick={() => { setActionsMenuOpen(false); void saveActiveFile() }}>
                  <Save size={16} /><span>Save</span><kbd>{saveShortcut}</kbd>
                </button>
                <button className="actions-menu-item" type="button" role="menuitem" onClick={() => { setActionsMenuOpen(false); setTerminalOpen((open) => !open) }}>
                  <Terminal size={16} /><span>{terminalOpen ? 'Hide terminal' : 'Show terminal'}</span><kbd>{primaryKey} J</kbd>
                </button>
                <button className="actions-menu-item" type="button" role="menuitem" onClick={() => { setActionsMenuOpen(false); setCommandPaletteOpen(true) }}>
                  <Command size={16} /><span>Command palette</span><kbd>{primaryKey} ⇧ P</kbd>
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="workspace-layout">
        <aside className={`sidebar${drawerOpen ? ' is-open' : ''}`} aria-label="Project files">
          <div className="sidebar-heading">
            <div><span className="eyebrow-label">WORKSPACE</span><h1>{workspaceName}</h1></div>
            <div className="sidebar-tools">
              <button className="small-icon-button" type="button" title={workspaceOpenLabel} aria-label={workspaceOpenLabel} onClick={() => void openWorkspace()}><FolderOpen size={16} /></button>
              <button className="small-icon-button" type="button" title="New file" aria-label="New file" onClick={() => setCreateOpen(true)}><FilePlus2 size={16} /></button>
            </div>
          </div>
          <div className="tree-label"><FolderOpen size={13} /><span>{workspaceName.toUpperCase()}</span><span className="tree-count">{files.length}</span></div>
          <div className="file-list">
            {files.map((file) => {
              const Icon = fileIcon(file.name)
              return (
                <button className={`file-row${activeFile?.id === file.id ? ' is-active' : ''}`} key={file.id} type="button" onClick={() => selectFile(file.id)}>
                  <Icon size={15} strokeWidth={1.7} />
                  <span title={file.path}>{fileLabel(file, files)}</span>
                  {file.content !== savedVersions[file.id] && <span className="dirty-dot" aria-label="Unsaved changes" />}
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
            <div className="breadcrumbs"><span>{workspaceName.toLowerCase()}</span><span className="crumb-slash">/</span><span>{activeFile?.name ?? 'No file'}</span></div>
            <div className="editor-heading-right"><span className={`document-state${isDirty ? ' is-dirty' : ''}`} aria-live="polite"><Circle size={8} fill="currentColor" />{isDirty ? 'Unsaved' : 'Saved'}</span></div>
          </div>

          <div className="tab-strip" role="tablist" aria-label="Open files">
            {tabs.filter((id) => files.some((file) => file.id === id)).map((id) => {
              const file = files.find((item) => item.id === id)
              const name = file ? fileLabel(file, files) : ''
              const Icon = fileIcon(name)
              const dirty = file ? file.content !== savedVersions[id] : false
              return (
                <div className={`file-tab${activeId === id ? ' is-active' : ''}`} key={id} role="tab" aria-selected={activeId === id}>
                  <button type="button" title={file?.path} onClick={() => selectFile(id)}><Icon size={14} /><span>{name}</span>{dirty && <span className="dirty-dot" />}</button>
                  <button className="tab-close" type="button" title={`Close ${file?.path ?? name}`} aria-label={`Close ${file?.path ?? name}`} onClick={() => closeTab(id)}><X size={13} /></button>
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

          <div className="editor-frame" style={{ '--editor-virtual-space': `${editorVirtualSpace}px` } as CSSProperties}>
            {activeFile ? (
              <CodeMirror
                value={activeFile.content}
                height="100%"
                theme={editorTheme}
                extensions={editorLanguageExtensions}
                onChange={updateContent}
                onCreateEditor={(view) => setEditorView(view)}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, highlightActiveLineGutter: true, bracketMatching: true, closeBrackets: true, autocompletion: true, tabSize: 2 }}
              />
            ) : <div className="empty-editor">Create a file to begin.</div>}
          </div>

          {terminalOpen && (
            <Suspense fallback={<div className="terminal-loading">Starting Morrow Shell...</div>}>
              <TerminalPanel files={files} onWriteFile={writeShellFile} onClose={() => setTerminalOpen(false)} />
            </Suspense>
          )}

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
              <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            </div>
            <div className="status-right"><span>Spaces: 2</span><span>UTF-8</span><span>{language}</span></div>
          </footer>
        </section>
      </main>

      <input ref={fileInput} className="visually-hidden" type="file" multiple accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.md,.txt,.rs,.py" onChange={(event) => void importBrowserFiles(event.target.files)} />
      <input ref={folderInput} className="visually-hidden" type="file" multiple accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.md,.txt,.rs,.py" onChange={(event) => void importBrowserFiles(event.target.files, true)} />

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

  {commandPaletteOpen && <CommandPalette commands={commands} onClose={() => setCommandPaletteOpen(false)} onRun={runCommand} />}

      {notice && <div className="notice" role="status"><Check size={15} />{notice}</div>}
    </div>
  )
}

export default App
