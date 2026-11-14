import type { Browser } from "./harness";

/** Exercise the real server-saved onboarding routes with synthetic answers. */
export async function apply(browser: Browser, form: Record<string, string>) {
  const base = "/provider/get-listed";
  const mode = form["mode"] ?? "fixed";
  const steps: [string, Record<string, string | string[]>][] = [
    [
      "business",
      {
        intent: "save",
        businessName: form["businessName"] ?? "",
        role: "owner",
      },
    ],
    [
      "service",
      {
        intent: "save",
        services: [form["service"] ?? "service"],
        work: mode === "both" ? ["fixed", "mobile"] : [mode],
        team: "solo",
      },
    ],
    [
      "location",
      {
        intent: "save",
        mode,
        metro: form["metro"] ?? "Gauteng",
        address: form["address"] ?? "",
        pinLat: form["latitude"] ?? "",
        pinLng: form["longitude"] ?? "",
        pinSource: "tap",
        radiusKm: form["radiusKm"] ?? "25",
      },
    ],
    [
      "about",
      {
        intent: "save",
        description: form["description"] ?? "",
        // Per-day hours (Claude 26): Mon–Fri 08:00–17:00, Sat 08:00–13:00.
        ...Object.fromEntries(
          [1, 2, 3, 4, 5, 6].flatMap((day) => [
            [`open-${String(day)}`, "on"],
            [`opens-${String(day)}`, "08:00"],
            [`closes-${String(day)}`, day === 6 ? "13:00" : "17:00"],
          ]),
        ),
      },
    ],
    ["check", { intent: "submit", adult: "on", probing: "on" }],
  ];
  for (const [step, answers] of steps) {
    await browser.send(`${base}/${step}`);
    const response = await browser.send(`${base}/${step}`, { form: answers });
    if (response.status !== 302 || step === "check") return response;
  }
  throw new Error("application did not reach submit");
}
