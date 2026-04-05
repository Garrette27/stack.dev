"use client"

import { GripVertical } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  AUTHORING_CODE_FENCE_LANGUAGES,
  getCodeFenceToolButtonLabel,
  insertCodeFenceAtSelection,
  moveCodeFenceTool,
  normalizeCodeFenceToolOrder,
  type AuthoringCodeFenceLanguage
} from "@/lib/admin/code-fence-tools"
import { readPersistedCodeFenceToolOrder, writePersistedCodeFenceToolOrder } from "@/lib/admin/authoring-session"

type AuthoringCodeFenceFieldProps = {
  label: string
  name?: string
  rows: number
  value: string
  placeholder: string
  emptyActionLabel: string
  helperText: string
  onChange: (value: string) => void
  onClear: () => void
}

type SelectionRange = {
  start: number
  end: number
}

/**
 * Wraps authoring textareas with the shared code-fence toolbar so insertion,
 * drag ordering, and remembered preferences stay consistent across admin.
 */
export function AuthoringCodeFenceField({
  label,
  name,
  rows,
  value,
  placeholder,
  emptyActionLabel,
  helperText,
  onChange,
  onClear
}: AuthoringCodeFenceFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const selectionRef = useRef<SelectionRange>({ start: value.length, end: value.length })
  const suppressNextInsertRef = useRef(false)
  const [toolOrder, setToolOrder] = useState(AUTHORING_CODE_FENCE_LANGUAGES)
  const [draggedLanguage, setDraggedLanguage] = useState<AuthoringCodeFenceLanguage | null>(null)
  const [dropTargetLanguage, setDropTargetLanguage] = useState<AuthoringCodeFenceLanguage | null>(null)

  useEffect(() => {
    setToolOrder(normalizeCodeFenceToolOrder(readPersistedCodeFenceToolOrder()))
  }, [])

  const syncSelectionRange = () => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    selectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd
    }
  }

  const focusInsertedCode = (start: number, end: number) => {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current

      if (!textarea) {
        return
      }

      textarea.focus()
      textarea.setSelectionRange(start, end)
      selectionRef.current = { start, end }
    })
  }

  const handleInsertCodeFence = (language: AuthoringCodeFenceLanguage) => {
    if (suppressNextInsertRef.current) {
      suppressNextInsertRef.current = false
      return
    }

    const { start, end } = selectionRef.current
    const clampedStart = Math.min(start, value.length)
    const clampedEnd = Math.min(end, value.length)
    const result = insertCodeFenceAtSelection({
      source: value,
      selectionStart: clampedStart,
      selectionEnd: clampedEnd,
      language
    })

    onChange(result.nextSource)
    focusInsertedCode(result.selectionStart, result.selectionEnd)
  }

  const persistToolOrder = (nextOrder: AuthoringCodeFenceLanguage[]) => {
    setToolOrder(nextOrder)
    writePersistedCodeFenceToolOrder(nextOrder)
  }

  const handleDrop = (targetLanguage: AuthoringCodeFenceLanguage) => {
    if (!draggedLanguage) {
      return
    }

    const nextOrder = moveCodeFenceTool(toolOrder, draggedLanguage, targetLanguage)
    suppressNextInsertRef.current = true
    setDraggedLanguage(null)
    setDropTargetLanguage(null)
    persistToolOrder(nextOrder)
  }

  return (
    <Field label={label}>
      <Textarea
        ref={textareaRef}
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={syncSelectionRange}
        onKeyUp={syncSelectionRange}
        onSelect={syncSelectionRange}
        onBlur={syncSelectionRange}
        placeholder={placeholder}
      />

      <div className="mt-3 grid gap-3">
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClear}>
            {emptyActionLabel}
          </Button>
        </div>

        <div className="grid gap-2">
          <p className="text-sm leading-7 text-[var(--ink-muted)]">
            Drag these insert buttons to reorder them. The toolbar remembers your preferred order, and each code block
            inserts at the current cursor or replaces your current selection.
          </p>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {toolOrder.map((language) => (
              <Button
                key={language}
                type="button"
                variant="secondary"
                size="sm"
                draggable
                className={
                  dropTargetLanguage === language
                    ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]"
                    : ""
                }
                onClick={() => handleInsertCodeFence(language)}
                onDragStart={(event) => {
                  setDraggedLanguage(language)
                  event.dataTransfer.effectAllowed = "move"
                  event.dataTransfer.setData("text/plain", language)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  setDropTargetLanguage(language)
                }}
                onDragLeave={() => {
                  if (dropTargetLanguage === language) {
                    setDropTargetLanguage(null)
                  }
                }}
                onDragEnd={() => {
                  setDraggedLanguage(null)
                  setDropTargetLanguage(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  handleDrop(language)
                }}
              >
                <GripVertical className="mr-1.5 h-3.5 w-3.5 text-[var(--ink-muted)]" />
                {getCodeFenceToolButtonLabel(language)}
              </Button>
            ))}
          </div>
        </div>

        <p className="text-sm leading-7 text-[var(--ink-muted)]">{helperText}</p>
      </div>
    </Field>
  )
}
