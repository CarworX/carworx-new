import { useId, useState, type ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

interface FilterChipProps {
  children: ReactNode;
  /** Controlled state. Omit for a chip that keeps its own state. */
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

/** A filter people toggle. aria-pressed carries the state; ink when on. */
export function FilterChip({
  children,
  pressed,
  defaultPressed = false,
  onPressedChange,
}: FilterChipProps) {
  const [own, setOwn] = useState(defaultPressed);
  const on = pressed ?? own;
  return (
    <button
      type="button"
      className="cx-chip"
      aria-pressed={on}
      onClick={() => {
        setOwn(!on);
        onPressedChange?.(!on);
      }}
    >
      {children}
    </button>
  );
}

export type Tone = "ok" | "info" | "warn" | "err";
const TONE_ICON: Record<Tone, IconName> = {
  ok: "check",
  info: "info",
  warn: "clock",
  err: "alert",
};

/** States a fact. Always a word, never colour alone; never for promotion. */
export function StatusLabel({
  tone = "ok",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span className={tone === "ok" ? "cx-label" : `cx-label ${tone}`}>
      <Icon name={TONE_ICON[tone]} size="sm" />
      {children}
    </span>
  );
}

export type Actor = "driver" | "business" | "carworx";
export function ActorChip({ actor }: { actor: Actor }) {
  const label = { driver: "Driver", business: "Business", carworx: "CarworX" }[
    actor
  ];
  return (
    <span className={actor === "driver" ? "cx-actor" : `cx-actor ${actor}`}>
      {label}
    </span>
  );
}

export interface SlotOption {
  time: string;
  taken?: boolean;
}

interface TimeSlotsProps {
  legend: string;
  options: readonly SlotOption[];
  name?: string;
  /** Nothing is chosen until the person chooses. */
  defaultValue?: string;
  onChange?: (time: string) => void;
}

/** Times in mono as a radio group; taken times are struck through. */
export function TimeSlots({
  legend,
  options,
  name,
  defaultValue,
  onChange,
}: TimeSlotsProps) {
  const auto = useId();
  return (
    <fieldset className="cx-slots">
      <legend className="cx-vh">{legend}</legend>
      {options.map((o) => (
        <label key={o.time} className="cx-slot">
          <input
            type="radio"
            name={name ?? auto}
            value={o.time}
            disabled={o.taken}
            defaultChecked={defaultValue === o.time}
            onChange={() => onChange?.(o.time)}
          />
          {o.time}
          {o.taken ? <span className="cx-vh"> (taken)</span> : null}
        </label>
      ))}
    </fieldset>
  );
}
