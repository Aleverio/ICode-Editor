import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import type { EditorCommand } from './types'

type CommandPaletteProps = {
  commands: EditorCommand[]
  onClose: () => void
  onRun: (commandId: string) => void
}

export function CommandPalette({ commands, onClose, onRun }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return commands
    return commands.filter((command) =>
      `${command.label} ${command.description} ${command.keywords}`.toLowerCase().includes(normalizedQuery),
    )
  }, [commands, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function runActiveCommand() {
    const command = filteredCommands[activeIndex]
    if (!command) return
    onClose()
    onRun(command.id)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, filteredCommands.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      runActiveCommand()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="command-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
        <h2 id="command-title">Command palette</h2>
        <div className="command-search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search commands"
            aria-controls="command-list"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-activedescendant={filteredCommands[activeIndex] ? `command-${filteredCommands[activeIndex].id}` : undefined}
            placeholder="Type a command..."
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
            onKeyDown={handleKeyDown}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="command-list" id="command-list" role="listbox" aria-label="Editor commands">
          {filteredCommands.length ? filteredCommands.map((command, index) => (
            <button
              className={`command-row${index === activeIndex ? ' is-active' : ''}`}
              id={`command-${command.id}`}
              key={command.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => { onClose(); onRun(command.id) }}
            >
              <span className="command-copy"><strong>{command.label}</strong><small>{command.description}</small></span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          )) : <p className="command-empty">No commands found</p>}
        </div>
        <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><CornerDownLeft size={13} /> Run</span></footer>
      </section>
    </div>
  )
}