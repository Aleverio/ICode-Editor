export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface DocumentTab {
  id: string
  name: string
  path?: string
  content: string
  savedContent: string
}

export interface TerminalResult {
  output: string
  exitCode: number
}
