import {
  Braces,
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileJson2,
  Folder,
  FolderOpen,
} from 'lucide-react'
import type { FileEntry } from '../editor/types'

interface FileTreeProps {
  entries: FileEntry[]
  expanded: Set<string>
  tree: Record<string, FileEntry[]>
  onOpen: (entry: FileEntry) => void
  depth: number
}

export function FileTree({ entries, expanded, tree, onOpen, depth }: FileTreeProps) {
  return (
    <div className="file-tree">
      {entries.map((entry) => (
        <div key={entry.path}>
          <button
            className="tree-entry"
            style={{ paddingLeft: `${12 + depth * 14}px` }}
            onClick={() => onOpen(entry)}
          >
            {entry.isDirectory ? (
              expanded.has(entry.path) ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )
            ) : (
              <span className="tree-spacer" />
            )}
            {entry.isDirectory ? (
              expanded.has(entry.path) ? (
                <FolderOpen size={15} className="folder-icon" />
              ) : (
                <Folder size={15} className="folder-icon" />
              )
            ) : (
              <FileGlyph name={entry.name} />
            )}
            <span>{entry.name}</span>
          </button>
          {entry.isDirectory && expanded.has(entry.path) && (
            <FileTree
              entries={tree[entry.path] ?? []}
              expanded={expanded}
              tree={tree}
              onOpen={onOpen}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function FileGlyph({ name }: { name: string }) {
  const extension = name.split('.').pop()?.toLowerCase()
  if (['ts', 'tsx', 'js', 'jsx'].includes(extension ?? ''))
    return <FileCode2 size={14} className="file-icon code-icon" />
  if (extension === 'json') return <FileJson2 size={14} className="file-icon json-icon" />
  if (['html', 'css'].includes(extension ?? ''))
    return <Braces size={14} className="file-icon markup-icon" />
  return <File size={14} className="file-icon" />
}
