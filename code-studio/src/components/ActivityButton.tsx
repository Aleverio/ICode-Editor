import type { ReactNode } from 'react'

interface ActivityButtonProps {
  active?: boolean
  title: string
  onClick: () => void
  children: ReactNode
}

export function ActivityButton({ active = false, title, onClick, children }: ActivityButtonProps) {
  return (
    <button
      className={`activity-button ${active ? 'selected' : ''}`}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
