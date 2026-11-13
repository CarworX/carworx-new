/**
 * The CarworX transactional emails, as data for the shared frame.
 * Callers pass validated records; every free-text field is cleaned and
 * escaped by the frame, and every link must be on the app's origin.
 */
import {
  clean,
  dateTime,
  dateTimeYear,
  day,
  duration,
  money,
  safeLink,
  time,
} from "./format";
import { renderEmail, type Email, type Inline, type Rendered } from "./frame";

export interface Business {
  name: string;
  demo: boolean;
}
export type Role = "manager" | "staff";

export type MailTemplate =
  | { kind: "verify"; link: string; expiresInMs: number }
  | { kind: "reset"; link: string; expiresInMs: number }
  | {
      kind: "invite";
      link: string;
      business: Business;
      inviterFirstName: string;
      role: Role;
      expiresAt: string;
    }
  | {
      kind: "enquiry_received";
      link: string;
      business: Business;
      service: string;
      ref: string;
      sentAt: string;
    }
  | {
      kind: "booking_request";
      link: string;
      service: string;
      customerFirstName: string;
      vehicle: string;
      start: string;
      priceMinor: number;
      acceptBy: string;
      ref: string;
    }
  | {
      kind: "booking_confirmed";
      link: string;
      business: Business;
      service: string;
      start: string;
      end: string;
      address: string;
      paidMinor: number;
      ref: string;
      freeCancelUntil: string | null;
    }
  | {
      kind: "reschedule";
      link: string;
      audience: "customer" | "provider";
      business: Business;
      service: string;
      oldStart: string;
      newStart: string;
      movedBy: "customer" | "business";
      ref: string;
    }
  | {
      kind: "cancellation";
      link: string;
      business: Business;
      service: string;
      start: string;
      cancelledBy: "customer" | "business";
      refundMinor: number;
      keptMinor: number;
      refundBusinessDays: number;
      ref: string;
    }
  | {
      kind: "receipt";
      link: string;
      pdfLink: string;
      business: Business;
      businessArea: string;
      lines: { label: string; amountMinor: number }[];
      method: string;
      paidAt: string;
      start: string;
      ref: string;
    }
  | { kind: "welcome_customer"; link: string; firstName: string | null }
  | {
      kind: "welcome_business_received";
      link: string;
      business: Business;
      reviewDays: number;
    }
  | {
      kind: "welcome_business_approved";
      link: string;
      listingLink: string;
      business: Business;
    }
  | {
      kind: "welcome_team";
      link: string;
      business: Business;
      role: Role;
      inviterFirstName: string;
    }
  | { kind: "welcome_admin"; link: string };

export type MailKind = MailTemplate["kind"];

const REF = /^[A-Z]{2,4}-[A-Z0-9]{3,12}$/;
function ref(value: string): string {
  if (!REF.test(value)) throw new Error("mail_reference");
  return value;
}
function biz(b: Business): Inline[] {
  return b.demo
    ? [{ strong: clean(b.name, 80) }, { demo: true }]
    : [{ strong: clean(b.name, 80) }];
}
function bizPlain(b: Business): string {
  return clean(b.name, 80) + (b.demo ? " (DEMO)" : "");
}
function hi(name: string | null): string {
  return name ? `Hi ${clean(name, 40)}, ` : "";
}
const ROLE_CAN: Record<Role, string> = {
  manager:
    "Managers can edit the listing, hours and services, reply to customers and manage bookings.",
  staff: "Staff can see the schedule and the bookings assigned to them.",
};

function build(t: MailTemplate, origin: string): Email {
  const link = safeLink(t.link, origin);
  switch (t.kind) {
    case "verify": {
      const life = duration(t.expiresInMs);
      return {
        subject: "Confirm your CarworX email",
        preheader: `One tap and your account is ready. The link works for ${life}.`,
        chip: { tone: "signal", text: `Link expires in ${life}` },
        eyebrow: "Account",
        title: "Confirm your email",
        titleQuiet: "and you're in.",
        blocks: [
          {
            kind: "p",
            text: `Thanks for joining CarworX. Confirm this is your address and your account is ready. The link works for ${life}.`,
          },
        ],
        action: { label: "Confirm my email", url: link },
        after: [
          {
            kind: "p",
            tone: "muted",
            text: "Didn't sign up? You can ignore this email. Nobody can use your address without this link.",
          },
        ],
        reason: "someone signed up for CarworX with this address.",
      };
    }
    case "reset": {
      const life = duration(t.expiresInMs);
      return {
        subject: "Reset your CarworX password",
        preheader: `Choose a new password. The link works for ${life}.`,
        chip: { tone: "signal", text: `Link expires in ${life}` },
        eyebrow: "Account",
        title: "Reset your password",
        titleQuiet: "it takes a minute.",
        blocks: [
          {
            kind: "p",
            text: `Someone asked to reset the password for this CarworX account. If it was you, choose a new one. The link works for ${life} and only once.`,
          },
        ],
        action: { label: "Choose a new password", url: link },
        after: [
          {
            kind: "p",
            tone: "muted",
            text: "Didn't ask for this? Ignore this email and your password stays the same. CarworX will never ask you for your password.",
          },
        ],
        reason: "a password reset was requested for your CarworX account.",
      };
    }
    case "invite": {
      const inviter = clean(t.inviterFirstName, 40);
      return {
        subject: `You're invited to join ${bizPlain(t.business)} on CarworX`,
        preheader: `${inviter} invited you as ${t.role}. The invite works until ${dateTime(t.expiresAt)}.`,
        chip: {
          tone: "signal",
          text: `Invite expires ${dateTime(t.expiresAt)}`,
        },
        eyebrow: "Team invite",
        title: `Join ${clean(t.business.name, 80)}`,
        titleQuiet: "on CarworX.",
        blocks: [
          {
            kind: "p",
            text: [
              `${inviter} invited you to the team at `,
              ...biz(t.business),
              ` as ${t.role}. ${ROLE_CAN[t.role]}`,
            ],
          },
          {
            kind: "p",
            tone: "muted",
            text: "Sign in with your own CarworX account to accept, or create one with this email address. Never share the link: it's yours.",
          },
        ],
        action: { label: "Accept invite", url: link },
        after: [
          {
            kind: "p",
            tone: "muted",
            text: "Not expecting this? Ignore it and nothing changes.",
          },
        ],
        reason: `${inviter} invited this address to a business on CarworX.`,
      };
    }
    case "enquiry_received":
      return {
        subject: `We've sent your enquiry to ${bizPlain(t.business)}`,
        preheader: `Reference ${ref(t.ref)}. Businesses usually reply within one working day.`,
        ref: ref(t.ref),
        eyebrow: "Enquiry sent",
        title: "Your enquiry is on its way",
        titleQuiet: "you haven't paid anything.",
        blocks: [
          {
            kind: "facts",
            rows: [
              { label: "To", value: biz(t.business) },
              { label: "For", value: clean(t.service, 80) },
              { label: "Sent", value: dateTime(t.sentAt) },
              { label: "Reference", value: ref(t.ref), mono: true },
            ],
          },
          {
            kind: "p",
            text: "What happens next: the business reads your enquiry and replies in CarworX with a price range or questions. We'll email you when they do. Most businesses reply within one working day.",
          },
        ],
        action: { label: "View enquiry", url: link },
        reason: "you sent an enquiry through CarworX.",
      };
    case "booking_request":
      return {
        subject: `New booking request: ${clean(t.service, 60)}, ${dateTime(t.start)}`,
        preheader: `Accept or decline by ${dateTime(t.acceptBy)}, or the slot is released.`,
        ref: ref(t.ref),
        chip: { tone: "signal", text: `Reply by ${dateTime(t.acceptBy)}` },
        eyebrow: "Booking request",
        title: `${clean(t.customerFirstName, 40)} wants a ${clean(t.service, 60).toLowerCase()}`,
        titleQuiet: `${dateTime(t.start)}.`,
        blocks: [
          {
            kind: "facts",
            rows: [
              { label: "Service", value: clean(t.service, 80) },
              { label: "When", value: dateTime(t.start) },
              { label: "Vehicle", value: clean(t.vehicle, 80) },
              { label: "Price", value: money(t.priceMinor), mono: true },
              { label: "Reference", value: ref(t.ref), mono: true },
            ],
          },
          {
            kind: "p",
            tone: "muted",
            text: `If you don't reply by ${time(t.acceptBy)}, the request lapses and the customer is told the slot wasn't confirmed. Nobody has paid yet.`,
          },
        ],
        action: { label: "Review request", url: link },
        reason: "a customer asked to book your business on CarworX.",
      };
    case "booking_confirmed":
      return {
        subject: `Booking confirmed: ${clean(t.service, 60)}, ${dateTime(t.start)}`,
        preheader: `${bizPlain(t.business)} expects you ${dateTime(t.start)}. Reference ${ref(t.ref)}.`,
        ref: ref(t.ref),
        chip: { tone: "blue", text: "Booking confirmed" },
        eyebrow: "Booking",
        title: "You're booked",
        titleQuiet: `${dateTime(t.start)}.`,
        blocks: [
          {
            kind: "facts",
            rows: [
              {
                label: "Where",
                value: [...biz(t.business), `, ${clean(t.address, 120)}`],
              },
              { label: "When", value: `${dateTime(t.start)} – ${time(t.end)}` },
              { label: "Service", value: clean(t.service, 80) },
              { label: "Paid", value: money(t.paidMinor), mono: true },
              { label: "Reference", value: ref(t.ref), mono: true },
            ],
          },
          {
            kind: "p",
            tone: "muted",
            text: t.freeCancelUntil
              ? `Free cancellation until ${dateTime(t.freeCancelUntil)}. After that, the business's cancellation terms apply. Your receipt comes in a separate email.`
              : "This booking follows the business's cancellation terms. Your receipt comes in a separate email.",
          },
        ],
        action: { label: "View booking", url: link },
        reason: "you booked and paid through CarworX.",
      };
    case "reschedule": {
      const who =
        t.movedBy === t.audience
          ? "You moved"
          : t.movedBy === "business"
            ? `${clean(t.business.name, 80)} moved`
            : "The customer moved";
      return {
        subject: `Your booking moved to ${dateTime(t.newStart)}`,
        preheader: `${who} ${clean(t.service, 60)} from ${dateTime(t.oldStart)} to ${dateTime(t.newStart)}.`,
        ref: ref(t.ref),
        eyebrow: "Booking moved",
        title: "New time",
        titleQuiet: `${dateTime(t.newStart)}.`,
        blocks: [
          {
            kind: "p",
            text: `${who} this booking. Everything else stays the same, including what was paid.`,
          },
          {
            kind: "facts",
            rows: [
              {
                label: "When",
                value: { strong: dateTime(t.newStart) },
                was: dateTime(t.oldStart),
              },
              { label: "Service", value: clean(t.service, 80) },
              { label: "Business", value: biz(t.business) },
              { label: "Reference", value: ref(t.ref), mono: true },
            ],
          },
        ],
        action: { label: "View booking", url: link },
        reason:
          t.audience === "customer"
            ? "you have a booking through CarworX."
            : "your business has a booking through CarworX.",
      };
    }
    case "cancellation": {
      const by =
        t.cancelledBy === "customer"
          ? "You cancelled"
          : `${clean(t.business.name, 80)} cancelled`;
      return {
        subject:
          t.refundMinor > 0
            ? `Booking cancelled: refund of ${money(t.refundMinor)}`
            : "Booking cancelled",
        preheader: `${by} ${clean(t.service, 60)} on ${day(t.start)}.`,
        ref: ref(t.ref),
        eyebrow: "Booking cancelled",
        title: "Booking cancelled",
        titleQuiet:
          t.refundMinor > 0
            ? `${money(t.refundMinor)} is on its way back.`
            : "no refund is due.",
        blocks: [
          {
            kind: "p",
            text: `${by} ${clean(t.service, 60)} at ${bizPlain(t.business)}, ${dateTime(t.start)}.`,
          },
          {
            kind: "facts",
            rows: [
              { label: "Refund", value: money(t.refundMinor), mono: true },
              ...(t.keptMinor > 0
                ? [
                    {
                      label: "Kept",
                      value: `${money(t.keptMinor)} (late cancellation, the business's terms)`,
                    },
                  ]
                : []),
              {
                label: "Arrives",
                value: `Within ${String(t.refundBusinessDays)} business days, to the card you paid with`,
              },
              { label: "Reference", value: ref(t.ref), mono: true },
            ],
          },
          {
            kind: "p",
            tone: "muted",
            text: "Banks set the timing, so it can show a few days after we send it. CarworX never holds your money.",
          },
        ],
        action: { label: "View refund", url: link },
        reason: "you had a booking through CarworX.",
      };
    }
    case "receipt": {
      if (t.lines.length === 0 || t.lines.length > 20)
        throw new Error("mail_receipt_lines");
      const total = t.lines.reduce((s, l) => s + l.amountMinor, 0);
      return {
        subject: `Your CarworX receipt ${ref(t.ref)}`,
        preheader: `${money(total)} paid to ${bizPlain(t.business)}. Keep this as your receipt.`,
        ref: ref(t.ref),
        eyebrow: "Receipt",
        title: `${money(total)} paid`,
        titleQuiet: `see you ${day(t.start)}.`,
        blocks: [
          {
            kind: "p",
            text: [
              "Here's your receipt from ",
              ...biz(t.business),
              ". Keep this email for your records.",
            ],
          },
          {
            kind: "ticket",
            title: "Receipt",
            ref: ref(t.ref),
            lines: t.lines.map((l) => ({
              label: clean(l.label, 60),
              amount: money(l.amountMinor),
            })),
            total: { label: "Total paid", amount: money(total) },
            meta: [
              { label: "Paid", value: dateTimeYear(t.paidAt) },
              { label: "Method", value: clean(t.method, 40) },
              {
                label: "Paid to",
                value: [...biz(t.business), `, ${clean(t.businessArea, 60)}`],
              },
              { label: "Booking", value: dateTime(t.start) },
            ],
          },
        ],
        action: { label: "View booking", url: link },
        after: [
          {
            kind: "link",
            label: "Download PDF receipt",
            url: safeLink(t.pdfLink, origin),
          },
          {
            kind: "p",
            tone: "muted",
            text: "The business is the supplier; the payment went to them through our payment partner. CarworX never holds the money or stores your card details.",
          },
        ],
        reason: "you paid for a booking through CarworX.",
      };
    }
    case "welcome_customer":
      return {
        subject: "Welcome to CarworX",
        preheader: "Find a car service near you, ask for a price, and book.",
        eyebrow: "Welcome",
        title: "Welcome to CarworX",
        titleQuiet: "car services, near you.",
        blocks: [
          {
            kind: "p",
            text: `${hi(t.firstName)}your account is ready. Here's how it works:`,
          },
          {
            kind: "steps",
            items: [
              {
                title: "Find",
                text: "Search washes, mechanics, glass and tyres by area. Distances are straight-line.",
              },
              {
                title: "Enquire",
                text: "Ask a business for a price range. Free, and no obligation.",
              },
              {
                title: "Book",
                text: "Pick a time and pay the business in the app, where they offer it.",
              },
            ],
          },
          {
            kind: "p",
            tone: "muted",
            text: "You never pay CarworX. Businesses set their own prices.",
          },
        ],
        action: { label: "Find a car service", url: link },
        reason: "you created a CarworX account.",
      };
    case "welcome_business_received":
      return {
        subject: "We've received your CarworX application",
        preheader: `We review applications within ${String(t.reviewDays)} working days. Your listing stays hidden until then.`,
        eyebrow: "Application received",
        title: "Thanks for applying",
        titleQuiet: "we'll be in touch.",
        blocks: [
          {
            kind: "p",
            text: [
              "We've received the application for ",
              ...biz(t.business),
              ".",
            ],
          },
          {
            kind: "steps",
            items: [
              {
                title: "We check",
                text: "A person checks your details against public records. We may email you a question.",
              },
              {
                title: "We decide",
                text: `Usually within ${String(t.reviewDays)} working days. We'll email you either way.`,
              },
              {
                title: "You go live",
                text: "Once approved, your listing appears in search and you can invite your team.",
              },
            ],
          },
          {
            kind: "p",
            tone: "muted",
            text: "Your listing stays hidden until it's approved. Listing on CarworX is free.",
          },
        ],
        action: { label: "View your application", url: link },
        reason: "you applied to list a business on CarworX.",
      };
    case "welcome_business_approved":
      return {
        subject: `${bizPlain(t.business)} is live on CarworX`,
        preheader:
          "Your listing is live. Add your hours and services so customers can find you.",
        chip: { tone: "blue", text: "Approved" },
        eyebrow: "Welcome",
        title: `${clean(t.business.name, 80)} is live`,
        titleQuiet: "customers can find you now.",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Check your hours",
                text: "Customers see when you're open, and search uses it.",
              },
              {
                title: "List your services",
                text: "Add prices or ranges, so enquiries arrive with the right expectations.",
              },
              {
                title: "Invite your team",
                text: "Managers can reply to customers; staff see their schedule.",
              },
            ],
          },
        ],
        action: { label: "Open your dashboard", url: link },
        after: [
          {
            kind: "link",
            label: "See your public listing",
            url: safeLink(t.listingLink, origin),
          },
        ],
        reason: "your business was approved on CarworX.",
      };
    case "welcome_team": {
      const inviter = clean(t.inviterFirstName, 40);
      return {
        subject: `You've joined ${bizPlain(t.business)} on CarworX`,
        preheader: `You're a ${t.role} at ${bizPlain(t.business)}.`,
        eyebrow: "Welcome to the team",
        title: `You're in`,
        titleQuiet: `${t.role} at ${clean(t.business.name, 80)}.`,
        blocks: [
          {
            kind: "p",
            text: [
              `${inviter} added you to `,
              ...biz(t.business),
              `. ${ROLE_CAN[t.role]}`,
            ],
          },
          {
            kind: "p",
            tone: "muted",
            text: "Use your own sign-in every time. If you leave the business, the owner removes you and your own account stays yours.",
          },
        ],
        action: { label: "Open your dashboard", url: link },
        reason: "you accepted an invite to a business on CarworX.",
      };
    }
    case "welcome_admin":
      return {
        subject: "Finish setting up your CarworX admin access",
        preheader: "Admin pages open only after two-step sign-in is set up.",
        eyebrow: "Admin access",
        title: "One step left",
        titleQuiet: "set up two-step sign-in.",
        blocks: [
          {
            kind: "p",
            text: "You've been given admin access. Admin pages stay locked until you add an authenticator app and sign in with it.",
          },
          {
            kind: "p",
            tone: "muted",
            text: "If you didn't expect this, tell the CarworX owner straight away.",
          },
        ],
        action: { label: "Set up two-step sign-in", url: link },
        reason: "you were given admin access to CarworX.",
      };
  }
}

/** Render one email: subject, HTML and plain text, from validated data. */
export function render(template: MailTemplate, origin: string): Rendered {
  return renderEmail(build(template, origin), origin);
}

/** For the D-068 staging Send Email Hook: the same design as the Supabase templates. */
export function renderAuthEmail(
  action: "signup" | "recovery",
  link: string,
  origin: string,
  expiresInMs = 3_600_000,
): Rendered {
  return render(
    action === "signup"
      ? { kind: "verify", link, expiresInMs }
      : { kind: "reset", link, expiresInMs },
    origin,
  );
}
