import { ActorChip, type Actor } from "./Chip";
import { Icon, type IconName } from "./Icon";

export interface Step {
  actor: Actor;
  icon: IconName;
  title: string;
  body: string;
}

/** Numbered steps of a journey. Real order only; the active step lifts. */
export function StepList({
  steps,
  active,
}: {
  steps: readonly Step[];
  active?: number;
}) {
  return (
    <ol className="cx-steps">
      {steps.map((s, i) => (
        <li
          key={s.title}
          {...(i === active ? { "aria-current": "step" as const } : {})}
        >
          <span className="k">
            {/* G12: only .n is positioned; the icon stays centred. */}
            <span className="n" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <Icon name={s.icon} size="lg" />
          </span>
          <div>
            <ActorChip actor={s.actor} />
            <b>{s.title}</b>
            <p>{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
