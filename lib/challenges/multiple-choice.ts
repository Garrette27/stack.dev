import type { MultipleChoiceOption } from "@/lib/types"

const DEFAULT_OPTION_COUNT = 4

function createChoiceKey(index: number) {
  return `choice_${index + 1}`
}

/**
 * Returns a stable starter set of choices so new multiple-choice assignments
 * always open with a complete shape in the authoring UI.
 */
export function createDefaultMultipleChoiceOptions(count = DEFAULT_OPTION_COUNT): MultipleChoiceOption[] {
  return Array.from({ length: count }, (_, index) => ({
    key: createChoiceKey(index),
    label: ""
  }))
}

/**
 * Normalizes stored choice rows into the small shape the app expects.
 */
export function normalizeMultipleChoiceOptions(value: unknown): MultipleChoiceOption[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null
      }

      const rawKey = "key" in entry ? entry.key : null
      const rawLabel = "label" in entry ? entry.label : null
      const key = typeof rawKey === "string" && rawKey.trim() ? rawKey.trim() : createChoiceKey(index)
      const label = typeof rawLabel === "string" ? rawLabel : ""

      return {
        key,
        label
      } satisfies MultipleChoiceOption
    })
    .filter((entry): entry is MultipleChoiceOption => Boolean(entry))
}

/**
 * Keeps the option editor stable by preserving a minimum number of visible
 * choices and trimming blank trailing rows.
 */
export function ensureMultipleChoiceOptionShape(
  options: MultipleChoiceOption[],
  minimumCount = DEFAULT_OPTION_COUNT
): MultipleChoiceOption[] {
  const normalized = normalizeMultipleChoiceOptions(options)
  const padded = [...normalized]

  while (padded.length < minimumCount) {
    padded.push({
      key: createChoiceKey(padded.length),
      label: ""
    })
  }

  return padded
}

/**
 * Produces the next option row while hiding key-allocation details from the UI.
 */
export function createNextMultipleChoiceOption(options: MultipleChoiceOption[]): MultipleChoiceOption {
  const usedKeys = new Set(options.map((option) => option.key))
  let index = options.length

  while (usedKeys.has(createChoiceKey(index))) {
    index += 1
  }

  return {
    key: createChoiceKey(index),
    label: ""
  }
}
