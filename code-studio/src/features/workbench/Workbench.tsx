import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Circle,
  FileCode2,
  FilePlus2,
  Files,
  FolderOpen,
  FolderPlus,
  PanelBottom,
  Search,
  X,
} from 'lucide-react'
import { ActivityButton } from '../../components/ActivityButton'
import { CodeEditor } from '../editor/CodeEditor'
import type { FileEntry } from '../editor/types'
import { FileGlyph, FileTree } from '../explorer/FileTree'
import { TerminalPanel } from '../terminal/TerminalPanel'
import { useWorkspace } from '../workspace/useWorkspace'
import '../../workbench.css'

const commandActions = [
  { id: 'open-folder', label: 'Buka Folder...', shortcut: 'Ctrl O' },
  { id: 'save', label: 'Simpan File', shortcut: 'Ctrl S' },
  { id: 'terminal', label: 'Toggle Terminal', shortcut: 'Ctrl Shift T' },
] as const

interface PaletteItem {
  id: string
  label: string
  detail?: string
  shortcut?: string
  file?: FileEntry
}

function getLanguageName(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase()
  const names: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript JSX',
    js: 'JavaScript',
    jsx: 'JavaScript JSX',
    json: 'JSON',
    html: 'HTML',
    htm: 'HTML',
    css: 'CSS',
    md: 'Markdown',
    markdown: 'Markdown',
  }
  return names[extension ?? ''] ?? 'Plain Text'
}

function Workbench() {
  const workspace = useWorkspace()
  const [activity, setActivity] = useState<'explorer' | 'search' | 'languages'>('explorer')
  const [filter, setFilter] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [itemDialog, setItemDialog] = useState<'file' | 'folder' | null>(null)
  const [itemName, setItemName] = useState('')
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalCommand, setTerminalCommand] = useState('')

  const activeTab = workspace.activeTab
  const visibleFiles = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return query
      ? workspace.files.filter((file) => file.name.toLowerCase().includes(query))
      : workspace.files
  }, [filter, workspace.files])
  const paletteItems = useMemo<PaletteItem[]>(() => {
    const query = paletteQuery.trim().toLowerCase()
    const commands = commandActions
      .filter((action) => !query || action.label.toLowerCase().includes(query))
      .map((action) => ({ ...action }))
    const files = workspace.files
      .filter(
        (file) =>
          !query ||
          file.name.toLowerCase().includes(query) ||
          file.path.toLowerCase().includes(query),
      )
      .slice(0, 8)
      .map((file) => ({ id: `file:${file.path}`, label: file.name, detail: file.path, file }))
    return [...commands, ...files]
  }, [paletteQuery, workspace.files])

  const runAction = (id: string) => {
    setPaletteOpen(false)
    setPaletteQuery('')
    if (id === 'open-folder') void workspace.openWorkspace()
    else if (id === 'save') void workspace.saveActive()
    else if (id === 'terminal') setTerminalOpen((current) => !current)
    else {
      const file = workspace.files.find((entry) => `file:${entry.path}` === id)
      if (file) void workspace.openFile(file)
    }
  }

  const submitTerminal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const command = terminalCommand.trim()
    if (!command) return
    setTerminalCommand('')
    void workspace.runCommand(command)
  }

  const submitNewItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!itemDialog || !itemName.trim()) return
    const created = await workspace.createItem(itemName, itemDialog === 'folder')
    if (created) {
      setItemDialog(null)
      setItemName('')
    }
  }

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    const modifier = event.ctrlKey || event.metaKey
    if (modifier && event.key.toLowerCase() === 'p') {
      event.preventDefault()
      setPaletteQuery('')
      setPaletteOpen(true)
    } else if (modifier && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void workspace.saveActive()
    } else if (modifier && event.key.toLowerCase() === 'o') {
      event.preventDefault()
      void workspace.openWorkspace()
    } else if (modifier && event.shiftKey && event.key.toLowerCase() === 't') {
      event.preventDefault()
      setTerminalOpen((current) => !current)
    } else if (event.key === 'Escape') {
      setPaletteOpen(false)
      setItemDialog(null)
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  return (
    <main className="workbench">
      <header className="titlebar">
        <div className="brand-mark">
          <Braces size={17} strokeWidth={2.4} />
        </div>
        <span className="brand-name">Code Studio</span>
        <button className="command-search" onClick={() => setPaletteOpen(true)}>
          <Search size={14} />
          <span>Cari file atau perintah...</span>
          <kbd>Ctrl P</kbd>
        </button>
        <div className="title-actions">
          <button
            className="icon-button"
            title="Simpan file (Ctrl+S)"
            onClick={() => void workspace.saveActive()}
          >
            <FileCode2 size={16} />
          </button>
          <button
            className="icon-button"
            title="Tampilkan terminal"
            onClick={() => setTerminalOpen((current) => !current)}
          >
            <PanelBottom size={16} />
          </button>
        </div>
      </header>

      <div className="main-layout">
        <nav className="activity-bar" aria-label="Tampilan utama">
          <div className="activity-group">
            <ActivityButton
              active={activity === 'explorer'}
              title="Explorer"
              onClick={() => setActivity('explorer')}
            >
              <Files size={19} />
            </ActivityButton>
            <ActivityButton
              active={activity === 'search'}
              title="Cari file"
              onClick={() => setActivity('search')}
            >
              <Search size={19} />
            </ActivityButton>
            <ActivityButton
              active={activity === 'languages'}
              title="Bahasa editor"
              onClick={() => setActivity('languages')}
            >
              <Braces size={19} />
            </ActivityButton>
          </div>
        </nav>

        <aside className="sidebar">
          <div className="sidebar-heading">
            <span>
              {activity === 'explorer'
                ? 'EXPLORER'
                : activity === 'search'
                  ? 'SEARCH'
                  : 'LANGUAGES'}
            </span>
            <div className="sidebar-tools">
              {activity === 'explorer' && (
                <>
                  <button
                    className="icon-button small"
                    title="File baru"
                    disabled={!workspace.workspacePath}
                    onClick={() => setItemDialog('file')}
                  >
                    <FilePlus2 size={15} />
                  </button>
                  <button
                    className="icon-button small"
                    title="Folder baru"
                    disabled={!workspace.workspacePath}
                    onClick={() => setItemDialog('folder')}
                  >
                    <FolderPlus size={15} />
                  </button>
                </>
              )}
              <button
                className="icon-button small"
                title="Buka folder"
                onClick={() => void workspace.openWorkspace()}
              >
                <FolderOpen size={15} />
              </button>
            </div>
          </div>

          {activity === 'explorer' &&
            (workspace.workspacePath ? (
              <div className="tree-scroll">
                <button
                  className="root-folder"
                  onClick={() =>
                    workspace.setExpanded((current) =>
                      current.has(workspace.workspacePath)
                        ? new Set()
                        : new Set([workspace.workspacePath]),
                    )
                  }
                >
                  {workspace.expanded.has(workspace.workspacePath) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  <FolderOpen size={15} />
                  <span>{workspace.workspaceName}</span>
                </button>
                {workspace.expanded.has(workspace.workspacePath) && (
                  <FileTree
                    entries={workspace.tree[workspace.workspacePath] ?? []}
                    expanded={workspace.expanded}
                    tree={workspace.tree}
                    onOpen={(entry) => void workspace.openFile(entry)}
                    depth={1}
                  />
                )}
                {workspace.tree[workspace.workspacePath]?.length === 0 && (
                  <div className="empty-tree">Folder ini masih kosong.</div>
                )}
              </div>
            ) : (
              <div className="sidebar-empty">
                <div className="empty-icon">
                  <FolderOpen size={22} />
                </div>
                <p>Mulai dengan membuka folder project.</p>
                <button className="primary-button" onClick={() => void workspace.openWorkspace()}>
                  Buka Folder
                </button>
              </div>
            ))}

          {activity === 'search' && (
            <div className="sidebar-content">
              <label className="search-field">
                <Search size={14} />
                <input
                  autoFocus
                  placeholder="Cari nama file"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </label>
              <div className="search-results">
                {visibleFiles.map((file) => (
                  <button
                    className="search-result"
                    key={file.path}
                    onClick={() => void workspace.openFile(file)}
                  >
                    <FileGlyph name={file.name} />
                    <span>{file.name}</span>
                    <small>{file.path}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activity === 'languages' && (
            <div className="sidebar-content language-list">
              <p className="section-caption">SYNTAX HIGHLIGHTING</p>
              {['TypeScript / JavaScript', 'HTML', 'CSS', 'JSON', 'Markdown', 'Plain text'].map(
                (item) => (
                  <div className="language-row" key={item}>
                    <span className="language-dot" />
                    {item}
                  </div>
                ),
              )}
            </div>
          )}
          <div className="sidebar-footer">
            <span>{workspace.workspacePath ? 'WORKSPACE' : 'LOCAL EDITOR'}</span>
            <span className={workspace.workspacePath ? 'connected-dot' : 'muted-dot'} />
          </div>
        </aside>

        <section className="editor-area">
          <div className="tabs-row">
            <div className="tabs-list">
              {workspace.tabs.map((tab) => (
                <div
                  className={`tab-slot ${tab.id === workspace.activeId ? 'active' : ''}`}
                  key={tab.id}
                >
                  <button
                    className="tab"
                    title={tab.name}
                    onClick={() => workspace.setActiveId(tab.id)}
                  >
                    <FileGlyph name={tab.name} />
                    <span>{tab.name}</span>
                  </button>
                  {tab.content !== tab.savedContent ? (
                    <span className="dirty-dot" title="Belum disimpan">
                      <Circle size={8} fill="currentColor" />
                    </span>
                  ) : (
                    <button
                      className="tab-close"
                      title={`Tutup ${tab.name}`}
                      onClick={() => workspace.closeTab(tab.id)}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="tab-actions">
              <button
                className="icon-button small"
                title="File baru"
                disabled={!workspace.workspacePath}
                onClick={() => setItemDialog('file')}
              >
                <FilePlus2 size={15} />
              </button>
            </div>
          </div>

          {activeTab ? (
            <>
              <div className="breadcrumbs">
                <span>{workspace.workspaceName}</span>
                <ChevronRight size={13} />
                <FileGlyph name={activeTab.name} />
                <span>{activeTab.name}</span>
                {activeTab.content !== activeTab.savedContent && (
                  <span className="unsaved-label">Belum disimpan</span>
                )}
              </div>
              <div className="editor-scroll">
                <CodeEditor
                  filename={activeTab.name}
                  value={activeTab.content}
                  onChange={(content) =>
                    workspace.setTabs((current) =>
                      current.map((tab) => (tab.id === activeTab.id ? { ...tab, content } : tab)),
                    )
                  }
                />
              </div>
              <div className="editor-footer">
                <span>{activeTab.content.split('\n').length} baris</span>
                <span>UTF-8</span>
                <span>{getLanguageName(activeTab.name)}</span>
                <span>Indentasi: 2 spasi</span>
              </div>
            </>
          ) : (
            <div className="welcome-screen">
              <div className="welcome-mark">
                <Braces size={32} />
              </div>
              <p className="eyebrow">RUANG KERJA BARU</p>
              <h1>Mulai dari sini.</h1>
              <p className="welcome-copy">
                Buka folder project untuk mulai menjelajahi dan mengedit file.
              </p>
              <button className="primary-button" onClick={() => void workspace.openWorkspace()}>
                <FolderOpen size={15} />
                Buka Folder
              </button>
              <button className="welcome-link" onClick={workspace.restoreExample}>
                <FileCode2 size={14} />
                Buka contoh editor
              </button>
            </div>
          )}

          {terminalOpen && (
            <TerminalPanel
              output={workspace.terminalOutput}
              command={terminalCommand}
              enabled={Boolean(workspace.workspacePath)}
              onCommandChange={setTerminalCommand}
              onSubmit={submitTerminal}
              onClose={() => setTerminalOpen(false)}
            />
          )}
        </section>
      </div>

      <footer className="statusbar">
        <div className="status-left">
          <span>
            {activeTab && activeTab.content !== activeTab.savedContent ? 'Modified' : 'Ready'}
          </span>
          <span>{workspace.workspaceName}</span>
        </div>
        <div className="status-right">
          {workspace.notice && (
            <span className="notice-text" title={workspace.notice}>
              {workspace.notice}
            </span>
          )}
          <span>{activeTab ? getLanguageName(activeTab.name) : 'Plain Text'}</span>
          <span>UTF-8</span>
          <span className="status-tauri">TAURI 2</span>
        </div>
      </footer>

      {paletteOpen && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaletteOpen(false)
          }}
        >
          <div className="command-palette">
            <label className="palette-input">
              <Search size={16} />
              <input
                autoFocus
                placeholder="Cari file atau perintah..."
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && paletteItems[0]) runAction(paletteItems[0].id)
                  if (event.key === 'Escape') setPaletteOpen(false)
                }}
              />
            </label>
            <div className="palette-results">
              {paletteItems.map((item) => (
                <button key={item.id} onClick={() => runAction(item.id)}>
                  {item.file ? (
                    <FileGlyph name={item.file.name} />
                  ) : item.id === 'terminal' ? (
                    <PanelBottom size={15} />
                  ) : item.id === 'open-folder' ? (
                    <FolderOpen size={15} />
                  ) : (
                    <FileCode2 size={15} />
                  )}
                  <span>{item.label}</span>
                  {item.detail && <small>{item.detail}</small>}
                  {item.shortcut && <kbd>{item.shortcut}</kbd>}
                </button>
              ))}
              {paletteItems.length === 0 && (
                <div className="palette-empty">Tidak ada hasil yang cocok.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {itemDialog && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setItemDialog(null)
          }}
        >
          <form className="item-dialog" onSubmit={(event) => void submitNewItem(event)}>
            <h2>{itemDialog === 'file' ? 'File baru' : 'Folder baru'}</h2>
            <p>
              Di dalam <strong>{workspace.workspaceName}</strong>
            </p>
            <input
              autoFocus
              placeholder={itemDialog === 'file' ? 'nama-file.ts' : 'nama-folder'}
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setItemDialog(null)}
              >
                Batal
              </button>
              <button className="primary-button" disabled={!itemName.trim()}>
                Buat
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

export default Workbench
