export type ShellPackage = {
  name: string
  version: string
  description: string
  commands: string[]
}

const storageKey = 'morrow.shell.packages.v1'

export const packageRegistry: ShellPackage[] = [
  {
    name: 'tree',
    version: '1.0.0',
    description: 'Print the workspace file tree.',
    commands: ['tree'],
  },
  {
    name: 'json-tools',
    version: '1.0.0',
    description: 'Format JSON files with jsonfmt.',
    commands: ['jsonfmt'],
  },
]

export class InternalPackageManager {
  private installed = new Set<string>()

  constructor() {
    try {
      const saved = localStorage.getItem(storageKey)
      const parsed: unknown = saved ? JSON.parse(saved) : []
      if (Array.isArray(parsed)) {
        this.installed = new Set(parsed.filter((name): name is string =>
          typeof name === 'string' && packageRegistry.some((item) => item.name === name),
        ))
      }
    } catch {
      this.installed = new Set()
    }
  }

  list() {
    return packageRegistry.filter((item) => this.installed.has(item.name))
  }

  search(query: string) {
    const normalized = query.toLowerCase()
    return packageRegistry.filter((item) =>
      `${item.name} ${item.description} ${item.commands.join(' ')}`.toLowerCase().includes(normalized),
    )
  }

  get(name: string) {
    return packageRegistry.find((item) => item.name === name)
  }

  isInstalled(name: string) {
    return this.installed.has(name)
  }

  install(name: string) {
    const item = this.get(name)
    if (!item) return `pkg: package not found: ${name}`
    if (this.installed.has(name)) return `${name} ${item.version} is already installed.`
    this.installed.add(name)
    this.persist()
    return `Installed ${name} ${item.version}. Commands available: ${item.commands.join(', ')}.`
  }

  remove(name: string) {
    const item = this.get(name)
    if (!item) return `pkg: package not found: ${name}`
    if (!this.installed.delete(name)) return `${name} is not installed.`
    this.persist()
    return `Removed ${name}.`
  }

  private persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...this.installed]))
    } catch {
      // The current shell session still works when persistent storage is unavailable.
    }
  }
}