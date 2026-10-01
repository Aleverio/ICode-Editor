import { Braces, FileCode2, FileJson2, FileText, type LucideIcon } from 'lucide-react'
import type { StarterWorkspaceFile, WorkspaceFile } from './types'

export const storageKey = 'morrow.workspace.v1'

export function readWorkspace(starterFiles: StarterWorkspaceFile[]): WorkspaceFile[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (
        Array.isArray(parsed) &&
        parsed.every((file) => typeof file?.name === 'string' && typeof file?.content === 'string')
      ) {
        return parsed.map((file) => ({
          ...file,
          id: typeof file.id === 'string'
            ? file.id
            : file.path
              ? `path:${file.path.replaceAll('\\', '/')}`
              : `workspace:${file.name}`,
        })) as WorkspaceFile[]
      }
    }
  } catch {
    // Fall back to the starter workspace if saved data is unavailable.
  }
  return starterFiles.map((file) => ({ ...file, id: `workspace:${file.name}` }))
}

export function fileIcon(filename: string): LucideIcon {
  if (filename.endsWith('.json')) return FileJson2
  if (filename.endsWith('.md')) return FileText
  if (/\.(html|css|js|jsx|ts|tsx)$/.test(filename)) return FileCode2
  return Braces
}

export function filenameFromPath(path: string) {
  const encodedName = path.split(/[\\/]/).filter(Boolean).pop()
  if (!encodedName) return 'opened-file.txt'
  try {
    return decodeURIComponent(encodedName).split(/[\\/]/).filter(Boolean).pop()?.split(':').pop() || encodedName
  } catch {
    return encodedName
  }
}

export function fileLabel(file: WorkspaceFile, files: WorkspaceFile[]) {
  const sameName = files.filter((candidate) => candidate.name === file.name)
  if (sameName.length < 2) return file.name
  if (!file.path) return `${file.name} (${sameName.indexOf(file) + 1})`

  const pathParts = file.path.replaceAll('\\', '/').split('/').filter(Boolean)
  for (let segmentCount = 2; segmentCount <= pathParts.length; segmentCount += 1) {
    const suffix = pathParts.slice(-segmentCount).join('/')
    const isUnique = sameName.every((candidate) => {
      if (candidate === file || !candidate.path) return true
      return candidate.path.replaceAll('\\', '/').split('/').filter(Boolean).slice(-segmentCount).join('/') !== suffix
    })
    if (isUnique) return suffix
  }

  return file.path
}