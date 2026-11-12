import { ButtonLink } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { setupHref, type TeamRole } from "./forms";

export function SetupHub({
  org,
  role,
  live,
}: {
  org: string;
  role: TeamRole | undefined;
  live: boolean;
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
  const tasks = [
    {
      task: "team",
      title: "Team",
      description: "Invite managers and staff using a one-time link.",
      allowed: true,
    },
    {
      task: "assign",
      title: "Who gets the booking",
      description: "Customers choose a person, or your business assigns one.",
      allowed: true,
    },
    {
      task: "contact",
      title: "What staff can see",
      description:
        "Choose the customer details staff may see for their bookings.",
      allowed: role === "owner",
    },
    {
      task: "cover",
      title: "Cover photo",
      description: "Photo uploads follow a storage and privacy review.",
      allowed: true,
    },
  ];
  return (
    <section className="mt-6 grid gap-4" aria-label="Finish setup">
      <div>
        <p className="type-label text-quiet">You're live</p>
        <h3 className="type-title mt-2">Finish setup</h3>
        <p className="type-body mt-2">
          Choose a task in any order. Your listing stays live while you finish.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {tasks.map((task) => (
          <article
            key={task.task}
            className="rounded-2xl bg-[var(--surface)] grid gap-3 p-5"
          >
            <h4 className="type-label">{task.title}</h4>
            <p className="type-body">{task.description}</p>
            {task.allowed ? (
              <div>
                <ButtonLink
                  size="sm"
                  variant="outline"
                  href={setupHref(org, task.task)}
                >
                  {task.task === "cover" ? "Details" : "Open"}
                </ButtonLink>
              </div>
            ) : (
              <p className="type-caption text-quiet">The owner chooses this.</p>
            )}
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
