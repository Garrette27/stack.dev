import { buildThemeInitScript } from "@/lib/theme"

/**
 * Applies the saved theme before React hydrates so layout chrome can render in
 * the chosen mode without a flash of the opposite palette.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
}
