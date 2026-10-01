import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { getLanguageExtensions } from './languageSupport'

interface CodeEditorProps {
  filename: string
  value: string
  onChange: (value: string) => void
}

export function CodeEditor({ filename, value, onChange }: CodeEditorProps) {
  return (
    <CodeMirror
      className="code-editor"
      value={value}
      height="100%"
      theme={oneDark}
      extensions={getLanguageExtensions(filename)}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        autocompletion: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        rectangularSelection: true,
        highlightSelectionMatches: true,
      }}
    />
  )
}
