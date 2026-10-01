import { Play, X } from 'lucide-react'
import type { FormEvent } from 'react'

interface TerminalPanelProps {
  output: string[]
  command: string
  enabled: boolean
  onCommandChange: (command: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

export function TerminalPanel({
  output,
  command,
  enabled,
  onCommandChange,
  onSubmit,
  onClose,
}: TerminalPanelProps) {
  return (
    <section className="terminal-panel">
      <div className="terminal-heading">
        <div className="terminal-tabs">
          <span className="panel-tab active">TERMINAL</span>
        </div>
        <button className="icon-button small" title="Tutup terminal" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="terminal-content" aria-live="polite">
        {output.map((line, index) => (
          <div className={line.startsWith('$ ') ? 'terminal-command' : ''} key={`${index}-${line}`}>
            {line}
          </div>
        ))}
      </div>
      <form className="terminal-input-row" onSubmit={onSubmit}>
        <span className="terminal-prompt">$</span>
        <input
          aria-label="Perintah terminal"
          placeholder={enabled ? 'Jalankan perintah...' : 'Buka folder untuk menggunakan terminal'}
          value={command}
          onChange={(event) => onCommandChange(event.target.value)}
          disabled={!enabled}
        />
        <button
          className="icon-button small"
          title="Jalankan perintah"
          disabled={!enabled || !command.trim()}
        >
          <Play size={13} />
        </button>
      </form>
    </section>
  )
}
