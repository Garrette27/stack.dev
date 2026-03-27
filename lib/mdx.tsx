import { MDXRemote } from "next-mdx-remote/rsc"
import remarkGfm from "remark-gfm"

type MdxRendererProps = {
  source: string
  tone?: "light" | "dark"
}

/**
 * Renders lesson and assignment MDX using a small set of consistent typography
 * components, with optional dark-mode styling for the immersive learner view.
 */
export async function MdxRenderer({ source, tone = "light" }: MdxRendererProps) {
  const colors =
    tone === "dark"
      ? {
          heading: "text-white",
          body: "text-slate-200",
          code: "bg-white/10 text-white",
          pre: "border-white/10 bg-black/20 text-slate-100",
          blockquote: "border-[var(--accent)] bg-white/6 text-slate-200"
        }
      : {
          heading: "text-[var(--ink-strong)]",
          body: "text-[var(--ink)]",
          code: "bg-[color:rgb(31_41_55/0.08)] text-[var(--ink-strong)]",
          pre: "border-black/10 bg-[var(--ink-strong)] text-white",
          blockquote: "border-[var(--accent)] bg-[color:rgb(201_111_54/0.08)] text-[var(--ink)]"
        }

  return (
    <MDXRemote
      source={source}
      options={{
        mdxOptions: {
          remarkPlugins: [remarkGfm]
        }
      }}
      components={{
        h1: (props) => <h1 className={`font-serif text-4xl tracking-tight ${colors.heading}`} {...props} />,
        h2: (props) => <h2 className={`mt-10 font-serif text-2xl tracking-tight ${colors.heading}`} {...props} />,
        h3: (props) => <h3 className={`mt-8 text-xl font-semibold ${colors.heading}`} {...props} />,
        p: (props) => <p className={`mt-4 text-base leading-8 ${colors.body}`} {...props} />,
        ul: (props) => <ul className={`mt-4 list-disc space-y-2 pl-6 ${colors.body}`} {...props} />,
        ol: (props) => <ol className={`mt-4 list-decimal space-y-2 pl-6 ${colors.body}`} {...props} />,
        li: (props) => <li className="leading-7" {...props} />,
        code: (props) => (
          <code
            className={`rounded px-1.5 py-0.5 font-mono text-sm ${colors.code}`}
            {...props}
          />
        ),
        pre: (props) => (
          <pre
            className={`mt-6 overflow-x-auto rounded-3xl border p-5 text-sm ${colors.pre}`}
            {...props}
          />
        ),
        blockquote: (props) => (
          <blockquote className={`mt-6 rounded-r-2xl border-l-4 px-4 py-3 ${colors.blockquote}`} {...props} />
        )
      }}
    />
  )
}
