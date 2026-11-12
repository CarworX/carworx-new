import { PROBLEM_TEXT, type Problem } from "../../server/forms/submit";
import { StatusNote } from "../Note";

/** The one error note every visitor form shows. Never echoes input. */
export function FormProblem({
  problem,
  title,
}: {
  problem: Problem | undefined;
  title: string;
}) {
  if (!problem) return null;
  return (
    <div data-problem={problem}>
      <StatusNote tone="err" title={title}>
        {PROBLEM_TEXT[problem]}
      </StatusNote>
    </div>
  );
}
