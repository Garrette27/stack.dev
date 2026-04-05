import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { ReadOnlyCodePanel } from "@/components/code/read-only-code-panel"
import { getLocalLabDefinition } from "@/lib/local-labs"
import type { Challenge } from "@/lib/types"

type LocalLabWorkbenchProps = {
  challenge: Challenge
  isAuthenticated: boolean
  isCompleted: boolean
}

/**
 * Presents local-machine labs without exposing manifest parsing or storage
 * details to the lesson page or generic challenge dispatcher.
 */
export function LocalLabWorkbench({
  challenge,
  isAuthenticated,
  isCompleted
}: LocalLabWorkbenchProps) {
  const localLab = getLocalLabDefinition(challenge)

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,#141923,#121722)] text-white shadow-[0_24px_70px_rgba(11,15,24,0.36)]">
      <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Badge className="bg-white/10 text-white">Local lab</Badge>
            <p className="max-w-3xl text-sm leading-7 text-slate-300">
              This assignment runs on your machine through the CLI. Copy the submit command, complete the work locally, and let the CLI report the result back to the platform.
            </p>
          </div>
          <span className="text-xs uppercase tracking-[0.22em] text-white/45">
            {localLab.manifest ? `${localLab.manifest.checks.length} checks` : "config pending"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 px-5 py-6">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Submit command</h3>
          <ReadOnlyCodePanel
            code={localLab.commandTemplate}
            language="bash"
            tone="dark"
            className="border-white/10 bg-[#1a212d]"
            headerClassName="border-white/10 bg-[#151b27]"
          />
        </div>

        {localLab.manifest?.setupSteps.length ? (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Setup</h3>
            <ol className="grid gap-3 text-sm leading-7 text-slate-200">
              {localLab.manifest.setupSteps.map((step, index) => (
                <li
                  key={`${challenge.slug}-setup-${index}`}
                  className="rounded-[1rem] border border-white/8 bg-white/5 px-4 py-3"
                >
                  <span className="mr-2 font-semibold text-white/70">{index + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {localLab.manifest ? (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Checks</h3>
            <div className="grid gap-4">
              {localLab.manifest.checks.map((check) => (
                <article
                  key={check.id}
                  className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-white">{check.title}</h4>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                        Exit code {check.expectedExitCode}
                      </p>
                    </div>
                    <Badge className="bg-white/8 text-white ring-1 ring-white/10">CLI check</Badge>
                  </div>

                  <ReadOnlyCodePanel
                    code={check.command}
                    language="bash"
                    tone="dark"
                    className="border-white/10 bg-[#1a212d]"
                    headerClassName="border-white/10 bg-[#151b27]"
                  />

                  {check.expectedStdoutIncludes.length ? (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">stdout must include</p>
                      <ul className="mt-2 grid gap-2 text-sm text-slate-200">
                        {check.expectedStdoutIncludes.map((match) => (
                          <li key={`${check.id}-stdout-${match}`} className="rounded-xl bg-black/20 px-3 py-2 font-mono text-xs">
                            {match}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {check.expectedStderrIncludes.length ? (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">stderr must include</p>
                      <ul className="mt-2 grid gap-2 text-sm text-slate-200">
                        {check.expectedStderrIncludes.map((match) => (
                          <li key={`${check.id}-stderr-${match}`} className="rounded-xl bg-black/20 px-3 py-2 font-mono text-xs">
                            {match}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/10 px-4 py-4 text-sm text-white/60">
            This lab is still being configured. The manifest is not valid yet.
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-white/4 px-5 py-4">
        {!isAuthenticated ? (
          <p className="text-sm text-white/60">
            <Link href="/login" className="font-medium text-white underline decoration-[var(--accent)]">
              Sign in with Google
            </Link>{" "}
            so future CLI submissions can sync back to your account.
          </p>
        ) : isCompleted ? (
          <p className="text-sm text-white/55">This local lab is already marked complete from a synced submission.</p>
        ) : (
          <p className="text-sm text-white/55">Completion for local labs comes from the CLI workflow rather than the in-browser runner.</p>
        )}
      </div>
    </section>
  )
}
