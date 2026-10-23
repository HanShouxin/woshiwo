import { useEffect, useState } from 'react'

interface EditableTextProps {
  value: string
  placeholder?: string
  multiline?: boolean
  className?: string
  onSave: (next: string) => void
}

/**
 * 无感编辑：平时看起来是文字，聚焦才出现边框，失焦自动保存。
 * 空内容不落库（删除请用专门的删除按钮）。
 */
export default function EditableText({
  value,
  placeholder,
  multiline,
  className,
  onSave
}: EditableTextProps): React.JSX.Element {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit(): void {
    const next = draft.trim()
    if (next && next !== value) onSave(next)
    else if (!next) setDraft(value)
  }

  const shared = {
    value: draft,
    placeholder,
    className: `editable${className ? ` ${className}` : ''}`,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: commit
  }

  if (multiline) {
    return <textarea {...shared} rows={3} />
  }

  return (
    <input
      {...shared}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          ;(event.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
