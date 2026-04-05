import { CodeChallengeWorkbench } from "@/components/code/code-challenge-workbench"
import { LocalLabWorkbench } from "@/components/labs/local-lab-workbench"
import { MultipleChoiceWorkbench } from "@/components/quiz/multiple-choice-workbench"
import type { Challenge } from "@/lib/types"

type ChallengeWorkbenchProps = {
  challenge: Challenge
  courseSlug: string
  lessonSlug: string
  isAuthenticated: boolean
  isCompleted: boolean
  onCompletionChange?: (challengeSlug: string, completed: boolean) => void
}

/**
 * Dispatches each assignment type to the learner workbench that matches its
 * interaction model while keeping the lesson page unaware of those details.
 */
export function ChallengeWorkbench(props: ChallengeWorkbenchProps) {
  if (props.challenge.kind === "multiple_choice") {
    return <MultipleChoiceWorkbench {...props} />
  }

  if (props.challenge.kind === "local_lab") {
    return <LocalLabWorkbench {...props} />
  }

  return <CodeChallengeWorkbench {...props} />
}
