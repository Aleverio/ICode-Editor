import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { Circle, X } from 'lucide-react'
import type { WorkspaceFile } from '../editor/types'
import { MorrowShell } from './shell'
import '@xterm/xterm/css/xterm.css'

type TerminalPanelProps = {
  files: WorkspaceFile[]
  onWriteFile: (name: string, content: string) => string | undefined
  onClose: () => void
}

export function TerminalPanel({ files, onWriteFile, onClose }: TerminalPanelProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef({ files, writeFile: onWriteFile })

  useEffect(() => {
    hostRef.current = { files, writeFile: onWriteFile }
  }, [files, onWriteFile])

  useEffect(() => {
    if (!mountRef.current) return

    const terminal = new Terminal({
      allowProposedApi: false,
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 2000,
      theme: {
        background: '#101214',
        foreground: '#dce0e5',
        cursor: '#d1d5da',
        cursorAccent: '#101214',
        selectionBackground: '#343b42',
        black: '#101214',
        red: '#e09a8d',
        green: '#b9c2cb',
        yellow: '#d8c7a1',
        blue: '#a9c1d4',
        magenta: '#c5cbd2',
        cyan: '#b9cbd2',
        white: '#dce0e5',
        brightBlack: '#737981',
        brightRed: '#f0a99d',
        brightGreen: '#dce0e5',
        brightYellow: '#e8d8b2',
        brightBlue: '#c0d4e7',
        brightMagenta: '#e0e4ea',
        brightCyan: '#d2e2e9',
        brightWhite: '#f2f3f5',
      },
    })
    const fitAddon = new FitAddon()
    const shell = new MorrowShell()
    terminal.loadAddon(fitAddon)
    terminal.open(mountRef.current)

    let input = ''
    let historyIndex = shell.commandHistory.length
    const printPrompt = () => terminal.write(`\r\n\x1b[90m${shell.prompt}\x1b[0m`)

    terminal.writeln('\x1b[1mMorrow Shell\x1b[0m  virtual workspace · no host commands')
    terminal.writeln('Type "help" for commands. Use "pkg search" to browse tools.')
    terminal.write(`\r\n\x1b[90m${shell.prompt}\x1b[0m`)

    const dataSubscription = terminal.onData((data) => {
      if (data === '\r' || data === '\n') {
        const commandLine = input
        input = ''
        historyIndex = shell.commandHistory.length
        const result = shell.execute(commandLine, hostRef.current)
        if (result.clear) terminal.clear()
        else result.lines.forEach((line) => terminal.writeln(line))
        terminal.write(`\x1b[90m${shell.prompt}\x1b[0m`)
      } else if (data === '\u0003') {
        input = ''
        terminal.write('^C')
        printPrompt()
      } else if (data === '\u007f') {
        if (!input) return
        input = input.slice(0, -1)
        terminal.write('\b \b')
      } else if (data === '\x1b[A' || data === '\x1b[B') {
        const history = shell.commandHistory
        if (!history.length) return
        historyIndex = data === '\x1b[A'
          ? Math.max(0, historyIndex - 1)
          : Math.min(history.length, historyIndex + 1)
        input = history[historyIndex] ?? ''
        terminal.write('\r\x1b[2K')
        terminal.write(`\x1b[90m${shell.prompt}\x1b[0m${input}`)
      } else if (!data.startsWith('\x1b') && data >= ' ') {
        input += data
        terminal.write(data)
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
      } catch {
        // The terminal can be between layout states during mobile rotation.
      }
    })
    resizeObserver.observe(mountRef.current)
    requestAnimationFrame(() => {
      fitAddon.fit()
      terminal.focus()
    })

    return () => {
      resizeObserver.disconnect()
      dataSubscription.dispose()
      terminal.dispose()
    }
  }, [])

  return (
    <section
      className="terminal-panel"
      aria-label="Morrow Shell"
    >
      <header className="terminal-toolbar">
        <div className="terminal-heading"><Circle size={8} fill="currentColor" /><strong>TERMINAL</strong><span>MORROW SHELL</span></div>
        <button className="terminal-close" type="button" aria-label="Close terminal" title="Close terminal" onClick={onClose}><X size={15} /></button>
      </header>
      <div className="terminal-surface" ref={mountRef} />
    </section>
  )
}