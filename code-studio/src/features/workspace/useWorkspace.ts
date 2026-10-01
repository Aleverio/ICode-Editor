import { useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import type { DocumentTab, FileEntry, TerminalResult } from '../editor/types'

const starterContent = `const greeting = (name: string) => {
  return \`Halo, \${name}. Selamat datang di Code Studio.\`;
};

const workspace = {
  editor: "CodeMirror 6",
  desktop: "Tauri 2",
  language: "TypeScript",
};

console.log(greeting("developer"));
console.table(workspace);
`

const isDesktop = '__TAURI_INTERNALS__' in window

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function flattenEntries(entries: FileEntry[], tree: Record<string, FileEntry[]>): FileEntry[] {
  return entries.flatMap((entry) => [
    entry,
    ...(entry.isDirectory ? flattenEntries(tree[entry.path] ?? [], tree) : []),
  ])
}

export function useWorkspace() {
  const [workspacePath, setWorkspacePath] = useState('')
  const [workspaceName, setWorkspaceName] = useState('No Folder Open')
  const [tree, setTree] = useState<Record<string, FileEntry[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tabs, setTabs] = useState<DocumentTab[]>([
    {
      id: 'welcome.ts',
      name: 'welcome.ts',
      content: starterContent,
      savedContent: starterContent,
    },
  ])
  const [activeId, setActiveId] = useState('welcome.ts')
  const [notice, setNotice] = useState('')
  const [terminalOutput, setTerminalOutput] = useState([
    'Code Studio terminal',
    'Ketik perintah lalu tekan Enter.',
  ])
  const activeTab = tabs.find((tab) => tab.id === activeId)
  const files = useMemo(
    () => flattenEntries(tree[workspacePath] ?? [], tree).filter((entry) => !entry.isDirectory),
    [tree, workspacePath],
  )

  const loadDirectory = async (path: string): Promise<FileEntry[]> => {
    const entries = await invoke<FileEntry[]>('list_directory', { path })
    setTree((current) => ({ ...current, [path]: entries }))
    return entries
  }

  const openWorkspace = async () => {
    if (!isDesktop) {
      setNotice('Buka folder tersedia saat aplikasi dijalankan melalui Tauri.')
      return
    }
    const selected = await open({ directory: true, multiple: false, title: 'Pilih folder project' })
    if (typeof selected !== 'string') return
    const unsavedTabs = tabs.filter((tab) => tab.content !== tab.savedContent)
    if (
      unsavedTabs.length > 0 &&
      !window.confirm(
        `Buang ${unsavedTabs.length} perubahan yang belum disimpan dan buka folder lain?`,
      )
    ) {
      return
    }
    try {
      await loadDirectory(selected)
      setWorkspacePath(selected)
      setWorkspaceName(basename(selected))
      setExpanded(new Set([selected]))
      setTabs([])
      setActiveId('')
      setNotice('')
    } catch (error) {
      setNotice(`Folder tidak bisa dibuka: ${String(error)}`)
    }
  }

  const openFile = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      const willExpand = !expanded.has(entry.path)
      if (willExpand && !tree[entry.path]) {
        try {
          await loadDirectory(entry.path)
        } catch (error) {
          setNotice(`Folder tidak bisa dibaca: ${String(error)}`)
          return
        }
      }
      setExpanded((current) => {
        const next = new Set(current)
        if (willExpand) next.add(entry.path)
        else next.delete(entry.path)
        return next
      })
      return
    }
    const existing = tabs.find((tab) => tab.path === entry.path)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    try {
      const content = await invoke<string>('read_file', { path: entry.path })
      const tab: DocumentTab = {
        id: entry.path,
        path: entry.path,
        name: entry.name,
        content,
        savedContent: content,
      }
      setTabs((current) => [...current, tab])
      setActiveId(tab.id)
      setNotice('')
    } catch (error) {
      setNotice(`File tidak bisa dibuka: ${String(error)}`)
    }
  }

  const saveTab = async (tab: DocumentTab) => {
    let path = tab.path
    if (!path && isDesktop) {
      const selected = await save({ defaultPath: tab.name, title: 'Simpan file' })
      if (typeof selected !== 'string') return
      path = selected
    }
    if (!path) {
      setNotice('Simpan file tersedia saat aplikasi dijalankan melalui Tauri.')
      return
    }
    const contentToSave = tab.content
    try {
      await invoke('write_file', { path, contents: contentToSave })
      const savedPath = path
      setTabs((current) =>
        current.map((currentTab) =>
          currentTab.id === tab.id
            ? {
                ...currentTab,
                id: savedPath,
                path: savedPath,
                name: basename(savedPath),
                savedContent: contentToSave,
              }
            : currentTab,
        ),
      )
      setActiveId(savedPath)
      setNotice('File tersimpan')
    } catch (error) {
      setNotice(`File tidak bisa disimpan: ${String(error)}`)
    }
  }

  const createItem = async (name: string, isDirectory: boolean): Promise<boolean> => {
    if (!workspacePath || !name.trim()) return false
    try {
      const entry = await invoke<FileEntry>('create_item', {
        parent: workspacePath,
        name: name.trim(),
        isDirectory,
      })
      await loadDirectory(workspacePath)
      if (!entry.isDirectory) await openFile(entry)
      setNotice('')
      return true
    } catch (error) {
      setNotice(`Item tidak bisa dibuat: ${String(error)}`)
      return false
    }
  }

  const runCommand = async (command: string) => {
    if (!command.trim() || !workspacePath) return
    setTerminalOutput((current) => [...current, `$ ${command}`])
    try {
      const result = await invoke<TerminalResult>('run_terminal_command', {
        workspacePath,
        command,
      })
      const lines = result.output.trimEnd().split('\n').filter(Boolean)
      setTerminalOutput((current) => [
        ...current,
        ...(lines.length ? lines : ['(tidak ada output)']),
        `Exit code: ${result.exitCode}`,
      ])
    } catch (error) {
      setTerminalOutput((current) => [...current, String(error)])
    }
  }

  const closeTab = (id: string) => {
    const index = tabs.findIndex((tab) => tab.id === id)
    const tab = tabs[index]
    if (
      tab &&
      tab.content !== tab.savedContent &&
      !window.confirm(`Tutup ${tab.name} tanpa menyimpan perubahan?`)
    ) {
      return
    }
    setTabs((current) => current.filter((tab) => tab.id !== id))
    if (activeId === id) setActiveId(tabs[index - 1]?.id ?? tabs[index + 1]?.id ?? '')
  }

  const restoreExample = () => {
    setTabs([
      {
        id: 'welcome.ts',
        name: 'welcome.ts',
        content: starterContent,
        savedContent: starterContent,
      },
    ])
    setActiveId('welcome.ts')
  }

  return {
    activeId,
    activeTab,
    closeTab,
    createItem,
    expanded,
    files,
    notice,
    openFile,
    openWorkspace,
    restoreExample,
    runCommand,
    saveActive: () => activeTab && saveTab(activeTab),
    setActiveId,
    setExpanded,
    setTabs,
    tabs,
    terminalOutput,
    tree,
    workspaceName,
    workspacePath,
  }
}
