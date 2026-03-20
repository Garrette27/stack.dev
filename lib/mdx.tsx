import { MDXRemote } from "next-mdx-remote/rsc"
import remarkGfm from "remark-gfm"

type MdxRendererProps = {
  source: string
}

export async function MdxRenderer({ source }: MdxRendererProps) {
  return (
    <MDXRemote
      source={source}
      options={{
        mdxOptions: {
          remarkPlugins: [remarkGfm]
        }
      }}
      components={{
        h1: (props) => <h1 className="font-serif text-4xl tracking-tight text-[var(--ink-strong)]" {...props} />,
        h2: (props) => (
          <h2 className="mt-10 font-serif text-2xl tracking-tight text-[var(--ink-strong)]" {...props} />
        ),
        h3: (props) => <h3 className="mt-8 text-xl font-semibold text-[var(--ink-strong)]" {...props} />,
        p: (props) => <p className="mt-4 text-base leading-8 text-[var(--ink)]" {...props} />,
        ul: (props) => <ul className="mt-4 list-disc space-y-2 pl-6 text-[var(--ink)]" {...props} />,
        ol: (props) => <ol className="mt-4 list-decimal space-y-2 pl-6 text-[var(--ink)]" {...props} />,
        li: (props) => <li className="leading-7" {...props} />,
        code: (props) => (
          <code
            className="rounded bg-[color:rgb(31_41_55/0.08)] px-1.5 py-0.5 font-mono text-sm text-[var(--ink-strong)]"
            {...props}
          />
        ),
        pre: (props) => (
          <pre
            className="mt-6 overflow-x-auto rounded-3xl border border-black/10 bg-[var(--ink-strong)] p-5 text-sm text-white"
            {...props}
          />
        ),
        blockquote: (props) => (
          <blockquote
            className="mt-6 rounded-r-2xl border-l-4 border-[var(--accent)] bg-[color:rgb(201_111_54/0.08)] px-4 py-3 text-[var(--ink)]"
            {...props}
          />
        )
      }}
    />
  )
}
