export type WorkspaceFile = {
  id: string
  name: string
  content: string
  path?: string
}

export type StarterWorkspaceFile = Omit<WorkspaceFile, 'id'>

export type EditorShortcut = {
  key: string
  primary?: boolean
  shift?: boolean
}

export type EditorCommand = {
  id: string
  label: string
  description: string
  keywords: string
  shortcut?: string
  shortcuts?: EditorShortcut[]
}