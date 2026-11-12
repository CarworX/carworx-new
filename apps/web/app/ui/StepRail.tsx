import { Icon, type IconName } from "./Icon";

export interface RailStep {
  icon: IconName;
  title: string;
  body: string;
}

/**
 * The desktop step rail beside the segmented bar (owner, option A). Same
 * markup as StepList (G12: the number sits in .n beside the icon), with done
 * steps in ink and the current step lifted.
 */
export function StepRail({
  steps,
  current,
  label,
}: {
  steps: readonly RailStep[];
  current: number;
  label: string;
}) {
  return (
    <ol className="cx-steps cx-rail" aria-label={label}>
      {steps.map((s, i) => (
        <li
          key={s.title}
          className={i < current ? "done" : undefined}
          {...(i === current ? { "aria-current": "step" as const } : {})}
        >
          <span className="k">
            <span className="n" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <Icon name={i < current ? "check" : s.icon} size="lg" />
          </span>
          <div>
            <b>
              {s.title}
              {i < current ? <span className="cx-vh"> (done)</span> : null}
            </b>
            <p>{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
