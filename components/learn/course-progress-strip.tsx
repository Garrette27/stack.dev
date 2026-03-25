import Link from "next/link"

import type { Lesson } from "@/lib/types"

type CourseProgressStripProps = {
  courseSlug: string
  courseTitle: string
  courseIndex: number
  courseLessons: Lesson[]
  currentLessonIndex: number
}

/**
 * Shows the learner's current position inside a course without exposing
 * progress-query details to the page component.
 */
export function CourseProgressStrip({
  courseSlug,
  courseTitle,
  courseIndex,
  courseLessons,
  currentLessonIndex
}: CourseProgressStripProps) {
  const currentLesson = courseLessons[currentLessonIndex] ?? courseLessons[0]

  return (
    <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(160deg,rgba(25,31,45,0.97),rgba(33,39,57,0.94))] px-5 py-5 text-white shadow-[0_24px_60px_rgba(25,31,45,0.18)] sm:px-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase leading-[1.35] tracking-[0.22em] text-white/50">Course progress</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {courseLessons.map((lesson, index) => {
              const isCurrent = index === currentLessonIndex
              const isCompleted = index < currentLessonIndex

              return (
                <Link
                  key={lesson.id}
                  href={`/learn/${courseSlug}/${lesson.slug}`}
                  className={`inline-flex min-w-[4.5rem] items-center justify-center rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    isCurrent
                      ? "bg-[var(--accent)] text-white shadow-[0_10px_28px_rgba(201,111,54,0.32)]"
                      : isCompleted
                        ? "bg-white/16 text-white hover:bg-white/24"
                        : "bg-white/8 text-white/72 hover:bg-white/16 hover:text-white"
                  }`}
                >
                  {`CH${index + 1}`}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[30rem]">
          <div className="rounded-[1.25rem] border border-white/10 bg-white/8 px-4 py-3">
            <p className="text-[11px] uppercase leading-[1.35] tracking-[0.22em] text-white/50">Current chapter</p>
            <p className="mt-2 truncate text-sm font-semibold text-white">{`CH${currentLessonIndex + 1}: ${currentLesson?.title ?? ""}`}</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/8 px-4 py-3">
            <p className="text-[11px] uppercase leading-[1.35] tracking-[0.22em] text-white/50">Learning path</p>
            <p className="mt-2 truncate text-sm font-semibold text-white">{`L${courseIndex}: ${courseTitle}`}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
