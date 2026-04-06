import { CourseCatalog } from "@/components/learn/course-catalog"
import { getCurriculumLandingPageData } from "@/lib/data"

/**
 * Keeps the learner catalog route thin by delegating catalog interaction to a
 * dedicated course-catalog module.
 */
export default async function LearnIndexPage() {
  const curriculum = await getCurriculumLandingPageData()

  return (
    <div className="mx-auto grid w-full max-w-[1880px] gap-10 px-4 py-12 sm:px-6 xl:px-10">
      <CourseCatalog sections={curriculum.sections} />
    </div>
  )
}
