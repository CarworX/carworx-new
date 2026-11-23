import { ObIcon, type ObIconName } from "../sites/onboarding/kit";
import { ButtonLink } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { setupHref, type TeamRole } from "./forms";

/** The five Finish-setup tasks (organisations.setup_done). */
export const SETUP_TASKS = [
  "team",
  "assign",
  "contact",
  "secure",
  "cover",
] as const;
export type SetupTask = (typeof SETUP_TASKS)[number];

interface TaskCard {
  task: SetupTask;
  icon: ObIconName;
  title: string;
  description: string;
  /** Where Start/Edit goes; null when the task has no screen yet. */
  href: string | null;
  /** Owners only: a manager sees who decides instead of a button. */
  ownerOnly?: boolean;
}

/**
 * The Sites preview "Finish setup" hub (onboarding/setup/index.html #hub,
 * #83 @ b88a8ca), with the real tasks: Done comes from setup_done, which the
 * setup screens record when a choice is saved. Words are the preview's.
 */
export function SetupHub({
  org,
  orgName,
  role,
  live,
  done,
  hoursListing,
}: {
  org: string;
  orgName: string;
  role: TeamRole | undefined;
  live: boolean;
  done: readonly string[];
  /** A live listing whose opening hours the "Opening hours" link opens. */
  hoursListing?: string | undefined;
}) {
  if (role === "staff")
    return (
      <div className="mt-4 grid max-w-[65ch] gap-3" data-staff-home>
        <StatusNote title="Your work">
          Your own account is connected to this team. Booking assignments will
          appear here when bookings become available.
        </StatusNote>
        <div>
          <ButtonLink href={setupHref(org, "profile")} variant="outline">
            Your services and days
          </ButtonLink>
        </div>
      </div>
    );
  if (!live) return null;
  const cards: TaskCard[] = [
    {
      task: "team",
      icon: "team",
      title: "Team",
      description: "Invite managers and staff. Owners and managers can invite.",
      href: setupHref(org, "team"),
    },
    {
      task: "assign",
      icon: "user",
      title: "Who gets the booking",
      description: "Customers pick a staff member, or you assign one.",
      href: setupHref(org, "assign"),
    },
    {
      task: "contact",
      icon: "lock",
      title: "What staff can see",
      description: "How much customer detail your staff see.",
      href: setupHref(org, "contact"),
      ownerOnly: true,
    },
    {
      task: "secure",
      icon: "lock",
      title: "Team sign-in security",
      description: "Whether managers and staff must use two-step sign-in.",
      // Sites port: not wired yet (team two-step enforcement ships with O7).
      href: null,
      ownerOnly: true,
    },
    {
      task: "cover",
      icon: "eye",
      title: "Cover photo",
      description: "The first thing customers see on your listing.",
      href: setupHref(org, "cover"),
    },
  ];
  const isDone = (task: SetupTask) => done.includes(task);
  const count = cards.filter((c) => isDone(c.task)).length;
  const left = cards.length - count;
  return (
    <section className="ob-setup" aria-labelledby={`hub-${org}`} data-hub>
      <div className="hubhead">
        <div>
          <p className="cx-eyebrow">{orgName} · Live</p>
          <h2 id={`hub-${org}`}>Finish setup</h2>
          <p className="t-cap" style={{ marginTop: 6 }}>
            Your listing is already in search. These make bookings work the way
            you want.
          </p>
        </div>
        <div
          className="ring"
          style={{ "--p": count / cards.length } as React.CSSProperties}
          role="img"
          aria-label={`${String(count)} of ${String(cards.length)} setup tasks done`}
        >
          <b aria-hidden="true">
            {count}/{cards.length}
          </b>
        </div>
      </div>
      <div className="tasks">
        {cards.map((c) => {
          const ok = isDone(c.task);
          const mayEdit = !c.ownerOnly || role === "owner";
          return (
            <article
              key={c.task}
              className={ok ? "task done" : "task"}
              data-task={c.task}
            >
              <span className="ic">
                <ObIcon name={c.icon} />
              </span>
              <b>
                {c.title}{" "}
                <span className={ok ? "cx-label" : "cx-label info"}>
                  {ok ? "Done" : "To do"}
                </span>
              </b>
              <p>{c.description}</p>
              {!mayEdit ? (
                <p className="t-cap">The owner chooses this.</p>
              ) : c.href ? (
                <a className="cx-btn outlined sm" href={c.href}>
                  {ok ? "Edit" : "Start"}
                </a>
              ) : (
                // Sites port: not wired yet. Keeps the preview's look, inert.
                <span className="cx-btn outlined sm" data-inert>
                  Start<span className="cx-vh"> (not available yet)</span>
                </span>
              )}
            </article>
          );
        })}
      </div>
      <div className="sendbar">
        <p className="t-body">
          {left === 0
            ? "All set. You can change any of this later."
            : `${String(left)} task${left === 1 ? "" : "s"} to go. Your listing stays live either way.`}
        </p>
        {left === 0 ? (
          <span className="cx-label info">Setup complete</span>
        ) : null}
      </div>
      <section className="later" aria-labelledby={`later-${org}`}>
        <p className="cx-eyebrow" id={`later-${org}`}>
          Later · opens when bookings launch
        </p>
        <div className="tasks">
          <article className="task">
            <span className="ic">
              <ObIcon name="clock" />
            </span>
            <b>
              Prices and durations <span className="ob-lbl-off">Later</span>
            </b>
            <p>A price and time for each service.</p>
          </article>
          <article className="task">
            <span className="ic">
              <ObIcon name="flag" />
            </span>
            <b>
              Get paid <span className="ob-lbl-off">Later</span>
            </b>
            <p>Set up with our payment partner. Money goes straight to you.</p>
          </article>
          <article className="task">
            <span className="ic">
              <ObIcon name="van" />
            </span>
            <b>
              Travel charges <span className="ob-lbl-off">Later</span>
            </b>
            <p>Mobile only: a charge per distance band.</p>
          </article>
        </div>
      </section>
      {/* Real screens the preview's hub has no tile for: kept as links. */}
      <div className="flex flex-wrap gap-4" style={{ marginTop: 20 }}>
        {hoursListing ? (
          <a className="cx-tlink" href={`/provider/hours/${hoursListing}`}>
            Opening hours
          </a>
        ) : null}
        <a className="cx-tlink" href={setupHref(org, "profile")}>
          Your services and days
        </a>
        <a className="cx-tlink" href={setupHref(org, "history")}>
          History · Team changes
        </a>
      </div>
    </section>
  );
}
