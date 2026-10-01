import type { WorkspaceFile } from '../editor/types'
import { InternalPackageManager } from './packageManager'

export type ShellHost = {
  files: WorkspaceFile[]
  writeFile: (name: string, content: string) => string | undefined
}

export type ShellResult = {
  lines: string[]
  clear?: boolean
}

type TokenizeResult = { tokens: string[]; error?: undefined } | { error: string; tokens?: undefined }
type PathResult = { path: string; error?: undefined } | { error: string; path?: undefined }

function tokenize(input: string): TokenizeResult {
  const tokens: string[] = []
  let token = ''
  let quote = ''
  let escaped = false

  for (const character of input) {
    if (escaped) {
      token += character
      escaped = false
    } else if (character === '\\' && quote !== "'") {
      escaped = true
    } else if (quote) {
      if (character === quote) quote = ''
      else token += character
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === '>' || character === '|' || character === ';' || character === '<' || character === '&') {
      if (token) tokens.push(token)
      token = ''
      tokens.push(character)
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token)
      token = ''
    } else {
      token += character
    }
  }

  if (escaped) token += '\\'
  if (quote) return { error: 'morrow: unmatched quote' }
  if (token) tokens.push(token)
  return { tokens }
}

function normalizePath(path: string, cwd: string): PathResult {
  const input = path === '~' ? '/workspace' : path
  const parts = (input.startsWith('/') ? input : `${cwd}/${input}`).split('/').filter(Boolean)
  if (parts[0] !== 'workspace') return { error: 'morrow: path is outside the virtual workspace' }

  const normalized = ['workspace']
  for (const part of parts.slice(1)) {
    if (part === '.') continue
    if (part === '..') {
      if (normalized.length === 1) return { error: 'morrow: path is outside the virtual workspace' }
      normalized.pop()
      continue
    }
    normalized.push(part)
  }
  return { path: `/${normalized.join('/')}` }
}

function relativeToWorkspace(path: string) {
  return path.replace(/^\/workspace\/?/, '')
}

export class MorrowShell {
  cwd = '/workspace'
  readonly packages = new InternalPackageManager()
  private history: string[] = []

  get prompt() {
    const location = this.cwd === '/workspace' ? '~' : `~/${this.cwd.slice('/workspace/'.length)}`
    return `morrow:${location} $ `
  }

  get commandHistory() {
    return this.history
  }

  execute(input: string, host: ShellHost): ShellResult {
    const line = input.trim()
    if (!line) return { lines: [] }
    this.history.push(line)

    const parsed = tokenize(line)
    if (parsed.error !== undefined) return { lines: [parsed.error] }
    const tokens = parsed.tokens
    if (tokens.some((token) => token === '|' || token === ';' || token === '<' || token === '&')) {
      return { lines: ['morrow: pipes, chaining, and job control are not supported yet'] }
    }

    const command = tokens[0]
    const args = tokens.slice(1)
    switch (command) {
      case 'help':
        return { lines: [
          'Morrow Shell · virtual workspace only',
          'help  pwd  ls [path]  cd [path]  cat <file>  touch <file>',
          'echo <text> [> file]  clear  whoami  uname  pkg <action>',
          'Install optional tools with: pkg search | pkg install <name>',
          'No command is forwarded to the host operating system.',
        ] }
      case 'pwd':
        return { lines: [this.cwd] }
      case 'whoami':
        return { lines: ['morrow'] }
      case 'uname':
        return { lines: ['Morrow Virtual Shell'] }
      case 'clear':
        return { lines: [], clear: true }
      case 'ls':
        return this.listDirectory(args[0] ?? '.', host.files)
      case 'cd':
        return this.changeDirectory(args[0] ?? '/workspace', host.files)
      case 'cat':
        return this.readFiles(args, host.files)
      case 'touch':
        return this.touchFiles(args, host)
      case 'echo':
        return this.echo(args, host)
      case 'pkg':
        return this.packageCommand(args)
      case 'tree':
        return this.tree(host.files)
      case 'jsonfmt':
        return this.formatJson(args, host)
      default:
        return { lines: [`morrow: command not found: ${command}`, 'Run "help" to see available commands.'] }
    }
  }

  private resolve(path: string) {
    return normalizePath(path, this.cwd)
  }

  private listDirectory(path: string, files: WorkspaceFile[]): ShellResult {
    const resolved = this.resolve(path)
    if (resolved.error !== undefined) return { lines: [resolved.error] }
    const relativePath = relativeToWorkspace(resolved.path)
    const prefix = relativePath ? `${relativePath}/` : ''
    const entries = new Map<string, boolean>()

    for (const file of files) {
      if (!file.name.startsWith(prefix)) continue
      const remainder = file.name.slice(prefix.length)
      if (!remainder) continue
      const slash = remainder.indexOf('/')
      const name = slash === -1 ? remainder : remainder.slice(0, slash)
      entries.set(name, entries.get(name) === true || slash !== -1)
    }

    const values = [...entries].sort(([left, isLeftDirectory], [right, isRightDirectory]) =>
      Number(isRightDirectory) - Number(isLeftDirectory) || left.localeCompare(right),
    ).map(([name, isDirectory]) => isDirectory ? `${name}/` : name)
    return { lines: values.length ? values : ['(empty)'] }
  }

  private changeDirectory(path: string, files: WorkspaceFile[]): ShellResult {
    const resolved = this.resolve(path)
    if (resolved.error !== undefined) return { lines: [resolved.error] }
    const relativePath = relativeToWorkspace(resolved.path)
    const isDirectory = !relativePath || files.some((file) => file.name.startsWith(`${relativePath}/`))
    const isFile = files.some((file) => file.name === relativePath)
    if (isFile) return { lines: [`morrow: not a directory: ${path}`] }
    if (!isDirectory) return { lines: [`morrow: directory not found: ${path}`] }
    this.cwd = resolved.path
    return { lines: [] }
  }

  private readFiles(paths: string[], files: WorkspaceFile[]): ShellResult {
    if (!paths.length) return { lines: ['usage: cat <file>'] }
    const output: string[] = []
    for (const path of paths) {
      const resolved = this.resolve(path)
      if (resolved.error !== undefined) return { lines: [resolved.error] }
      const relativePath = relativeToWorkspace(resolved.path)
      const file = files.find((item) => item.name === relativePath)
      if (!file) return { lines: [`morrow: file not found: ${path}`] }
      output.push(file.content)
    }
    return { lines: output.join('\n').split('\n') }
  }

  private touchFiles(paths: string[], host: ShellHost): ShellResult {
    if (!paths.length) return { lines: ['usage: touch <file>'] }
    for (const path of paths) {
      const resolved = this.resolve(path)
      if (resolved.error !== undefined) return { lines: [resolved.error] }
      const relativePath = relativeToWorkspace(resolved.path)
      if (host.files.some((file) => file.name === relativePath)) continue
      const error = host.writeFile(relativePath, '')
      if (error) return { lines: [error] }
    }
    return { lines: [] }
  }

  private echo(args: string[], host: ShellHost): ShellResult {
    const redirectIndex = args.indexOf('>')
    if (redirectIndex === -1) return { lines: [args.join(' ')] }
    if (redirectIndex !== args.length - 2) return { lines: ['usage: echo <text> > <file>'] }

    const resolved = this.resolve(args[redirectIndex + 1])
    if (resolved.error !== undefined) return { lines: [resolved.error] }
    const error = host.writeFile(relativeToWorkspace(resolved.path), args.slice(0, redirectIndex).join(' '))
    return { lines: error ? [error] : [] }
  }

  private packageCommand(args: string[]): ShellResult {
    const [action, packageName] = args
    if (!action || action === 'help') {
      return { lines: [
        'Usage: pkg <search|list|info|install|remove> [package]',
        'Packages are curated, built-in tools. Installation never runs host scripts.',
      ] }
    }
    if (action === 'search') {
      const packages = this.packages.search(packageName ?? '')
      return { lines: packages.map((item) => `${item.name.padEnd(12)} ${item.version}  ${item.description}`) }
    }
    if (action === 'list') {
      const installed = this.packages.list()
      return { lines: installed.length ? installed.map((item) => `${item.name} ${item.version}`) : ['No packages installed.'] }
    }
    if (!packageName) return { lines: [`usage: pkg ${action} <package>`] }
    if (action === 'info') {
      const item = this.packages.get(packageName)
      return { lines: item ? [
        `${item.name} ${item.version}`,
        item.description,
        `Commands: ${item.commands.join(', ')}`,
        `Installed: ${this.packages.isInstalled(item.name) ? 'yes' : 'no'}`,
      ] : [`pkg: package not found: ${packageName}`] }
    }
    if (action === 'install') return { lines: [this.packages.install(packageName)] }
    if (action === 'remove') return { lines: [this.packages.remove(packageName)] }
    return { lines: [`pkg: unknown action: ${action}`] }
  }

  private tree(files: WorkspaceFile[]): ShellResult {
    if (!this.packages.isInstalled('tree')) return { lines: ['morrow: tree is not installed. Run "pkg install tree".'] }
    if (!files.length) return { lines: ['/workspace', '└── (empty)'] }
    const names = files.map((file) => file.name).sort()
    return { lines: ['/workspace', ...names.map((name, index) => `${index === names.length - 1 ? '└──' : '├──'} ${name}`)] }
  }

  private formatJson(args: string[], host: ShellHost): ShellResult {
    if (!this.packages.isInstalled('json-tools')) return { lines: ['morrow: jsonfmt is not installed. Run "pkg install json-tools".'] }
    if (args.length !== 1) return { lines: ['usage: jsonfmt <file>'] }
    const resolved = this.resolve(args[0])
    if (resolved.error !== undefined) return { lines: [resolved.error] }
    const relativePath = relativeToWorkspace(resolved.path)
    const file = host.files.find((item) => item.name === relativePath)
    if (!file) return { lines: [`morrow: file not found: ${args[0]}`] }
    try {
      const formatted = JSON.stringify(JSON.parse(file.content), null, 2)
      const error = host.writeFile(relativePath, formatted)
      return { lines: error ? [error] : [`Formatted ${relativePath}`] }
    } catch {
      return { lines: [`jsonfmt: invalid JSON in ${relativePath}`] }
    }
  }
}