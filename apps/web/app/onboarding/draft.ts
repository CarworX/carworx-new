/** Only explicitly entered answers and an explicitly chosen pin reach the draft RPC. */
export const STEPS = [
  "business",
  "service",
  "location",
  "about",
  "check",
] as const;
export type Step = (typeof STEPS)[number];
export const NOTICE_VERSION = "onboarding-probing-v1";
export const METROS = [
  "Johannesburg",
  "Pretoria / Tshwane",
  "Cape Town",
  "Durban / eThekwini",
  "Gqeberha / Nelson Mandela Bay",
  "East London / Buffalo City",
  "Bloemfontein / Mangaung",
  "Ekurhuleni",
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
] as const;
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export interface Hours {
  day: number;
  opens: string;
  closes: string;
}
export interface Draft {
  id: string;
  business_name: string | null;
  applicant_role: "owner" | "manager" | "other" | null;
  service_slugs: string[];
  mode: "fixed" | "mobile" | "both" | null;
  metro: string | null;
  public_address: string | null;
  pin_lat: number | null;
  pin_lng: number | null;
  pin_source: "tap" | "device" | null;
  radius_km: number | null;
  description: string | null;
  hours: Hours[];
  team_size_band: "solo" | "2-5" | "6-15" | "16+" | null;
  trading_since: string | null;
  step: number;
}

export function getStep(value: string | undefined): Step | null {
  return STEPS.find((step) => step === value) ?? null;
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
function text(
  form: FormData,
  name: string,
  min: number,
  max: number,
): string | null {
  const value = field(form, name);
  return value.length >= min &&
    value.length <= max &&
    // eslint-disable-next-line no-control-regex -- controls are invalid in single-line text
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}
function finite(
  form: FormData,
  name: string,
  min: number,
  max: number,
): number | null {
  const raw = field(form, name);
  if (!/^-?\d{1,3}(\.\d{1,17})?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/** A strict allowlist, never a spread of form data or a geocoding response. */
export function parseStep(
  form: FormData,
  step: Step,
  allowedServices: readonly string[],
): Record<string, unknown> | null {
  if (step === "business") {
    const business = text(form, "businessName", 2, 160);
    const role = field(form, "role");
    if (!business || !["owner", "manager", "other"].includes(role)) return null;
    return { business_name: business, applicant_role: role, step: 2 };
  }
  if (step === "service") {
    const services = form.getAll("services");
    const work = form.getAll("work");
    const team = field(form, "team");
    if (
      !services.length ||
      services.length > 8 ||
      new Set(services).size !== services.length ||
      services.some(
        (s) => typeof s !== "string" || !allowedServices.includes(s),
      ) ||
      !work.length ||
      work.length > 2 ||
      new Set(work).size !== work.length ||
      work.some((w) => w !== "fixed" && w !== "mobile") ||
      !["solo", "2-5", "6-15", "16+"].includes(team)
    )
      return null;
    const mode = work.length === 2 ? "both" : work[0];
    // Clear incompatible fields when the applicant changes how they work.
    return {
      service_slugs: services,
      mode,
      team_size_band: team,
      step: 3,
      ...(mode === "mobile" ? { public_address: null } : {}),
      ...(mode === "fixed" ? { radius_km: null } : {}),
    };
  }
  if (step === "location") {
    const metro = field(form, "metro");
    const lat = finite(form, "pinLat", -35, -22);
    const lng = finite(form, "pinLng", 16, 33);
    const source = field(form, "pinSource");
    const mode = field(form, "mode");
    if (
      !METROS.some((m) => m === metro) ||
      lat === null ||
      lng === null ||
      !["tap", "device"].includes(source) ||
      !["fixed", "mobile", "both"].includes(mode)
    )
      return null;
    const address = mode === "mobile" ? null : text(form, "address", 5, 300);
    const radius = mode === "fixed" ? null : finite(form, "radiusKm", 1, 100);
    if (
      (mode !== "mobile" && address === null) ||
      (mode !== "fixed" && (radius === null || !Number.isInteger(radius)))
    )
      return null;
    return {
      metro,
      pin: { lat, lng, source },
      public_address: address,
      radius_km: radius,
      step: 4,
    };
  }
  if (step === "about") {
    const description = field(form, "description").replace(/\r\n?/g, "\n");
    const days = form.getAll("days");
    const opens = field(form, "opens");
    const closes = field(form, "closes");
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (
      description.length < 10 ||
      description.length > 2000 ||
      // eslint-disable-next-line no-control-regex -- only newline is permitted in multiline text
      /[\u0000-\u0009\u000b-\u001f\u007f]/.test(description) ||
      !days.length ||
      days.length > 7 ||
      new Set(days).size !== days.length ||
      days.some((d) => !DAYS.some((day) => day === d)) ||
      !time.test(opens) ||
      !time.test(closes) ||
      closes <= opens
    )
      return null;
    return {
      description,
      hours: days.map((day) => ({
        day: DAYS.findIndex((d) => d === day) + 1,
        opens,
        closes,
      })),
      step: 5,
    };
  }
  return null;
}

export function incompleteStep(draft: Draft | null): Step | null {
  if (!draft?.business_name || !draft.applicant_role) return "business";
  if (!draft.service_slugs.length || !draft.mode || !draft.team_size_band)
    return "service";
  if (
    !draft.metro ||
    draft.pin_lat === null ||
    draft.pin_lng === null ||
    !draft.pin_source ||
    (draft.mode !== "mobile" && !draft.public_address) ||
    (draft.mode !== "fixed" && draft.radius_km === null)
  )
    return "location";
  if (!draft.description || !draft.hours.length) return "about";
  return null;
}
