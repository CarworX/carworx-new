import { ButtonLink } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { StatusNote } from "../ui/Note";
import { setupHref, type TeamRole } from "./forms";
import "./setup.css";

export function SetupHub({
  org,
  name,
  role,
  live,
  hoursListing,
  configuredHours,
  hasTeam,
}: {
  org: string;
  name: string;
  role: TeamRole | undefined;
  live: boolean;
  /** A live listing whose opening hours the "Opening hours" task opens. */
  hoursListing?: string | undefined;
  configuredHours: boolean | null;
  hasTeam: boolean;
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
  const tasks: {
    task: string;
    title: string;
    description: string;
    icon: IconName;
    status: string;
    ready?: boolean;
    href?: string;
  }[] = [
    ...(hoursListing
      ? [
          {
            task: "hours",
            title: "Opening hours",
            description: "Set each day's opening and closing times.",
            icon: "clock" as const,
            status:
              configuredHours === null
                ? "Status unavailable"
                : configuredHours
                  ? "Saved"
                  : "Set hours",
            ready: configuredHours === true,
            href: `/provider/hours/${hoursListing}`,
          },
        ]
      : []),
    {
      task: "team",
      title: "Team",
      description: "Invite managers and staff using a one-time link.",
      icon: "user",
      status: hasTeam ? "Team active" : "Optional",
      ready: hasTeam,
    },
    {
      task: "assign",
      title: "Who gets the booking",
      description: "Customers choose a person, or your business assigns one.",
      icon: "list",
      status: "Configured",
      ready: true,
    },
    ...(role === "owner"
      ? [
          {
            task: "contact",
            title: "What staff can see",
            description:
              "Choose the customer details staff may see for their bookings.",
            icon: "lock" as const,
            status: "Configured",
            ready: true,
          },
        ]
      : []),
    {
      task: "cover",
      title: "Cover photo",
      description: "Photo uploads follow a storage and privacy review.",
      icon: "camera",
      status: "Later",
    },
  ];
  const available = tasks.filter((task) => task.task !== "cover");
  const ready = available.filter((task) => task.ready).length;
  return (
    <section className="cx-setup-hub mt-6" aria-label="Finish setup">
      <div className="cx-setup-head">
        <div>
          <p className="type-label text-quiet">{name} · Live</p>
          <h3>Finish setup</h3>
          <p className="type-body">
            Your listing is already in search. Choose a task in any order.
          </p>
        </div>
        <div className="cx-setup-ring">
          <progress
            className="sr-only"
            aria-label="Setup tasks configured"
            value={ready}
            max={available.length}
          />
          <svg aria-hidden="true" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="40" />
            <circle
              cx="44"
              cy="44"
              r="40"
              pathLength="100"
              strokeDasharray={[(ready * 100) / available.length, 100].join(
                " ",
              )}
            />
          </svg>
          <b aria-hidden="true">
            {ready}/{available.length}
          </b>
        </div>
      </div>
      <div className="cx-setup-tasks">
        {tasks.map((task) => (
          <article
            key={task.task}
            className="cx-setup-task"
            data-ready={task.ready || undefined}
          >
            <span className="cx-setup-icon">
              <Icon name={task.icon} />
            </span>
            <h4>{task.title}</h4>
            <p>{task.description}</p>
            <div className="cx-setup-actions">
              <ButtonLink
                size="sm"
                variant="outline"
                href={task.href ?? setupHref(org, task.task)}
                aria-label={`${task.task === "cover" ? "Details" : "Open"}: ${task.title}`}
              >
                {task.task === "cover" ? "Details" : "Open"}
              </ButtonLink>
              <span className="type-caption">{task.status}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
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
