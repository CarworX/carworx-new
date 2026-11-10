import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { Icon } from "./Icon";

interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> {
  label: string;
  /** Privacy copy is part of the field: "Kept private", "Used only for this". */
  hint?: string;
  error?: string;
}

/** A labelled input. The label is always visible; never the placeholder. */
export function TextField({ label, hint, error, ...input }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="cx-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...input}
        id={id}
        className="cx-input"
        aria-describedby={describedBy}
        {...(error ? { "aria-invalid": true } : {})}
      />
      {hint ? (
        <span id={hintId} className="hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errId} className="error">
          <Icon name="alert" size="sm" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** The big search bar on canvas. */
export function SearchField({
  label,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className="cx-search">
      <Icon name="search" />
      <span className="cx-vh">{label}</span>
      <input {...input} type="search" />
    </label>
  );
}

interface SegmentedProps {
  legend: string;
  options: readonly { value: string; label: ReactNode }[];
  name?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

/** A two- or three-way choice (List / Map), with radio semantics. */
export function Segmented({
  legend,
  options,
  name,
  defaultValue,
  onChange,
}: SegmentedProps) {
  const auto = useId();
  return (
    <fieldset className="cx-seg">
      <legend className="cx-vh">{legend}</legend>
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            name={name ?? auto}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            onChange={() => onChange?.(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

interface ConsentProps {
  name: string;
  /** Say exactly what the data is used for. */
  children: ReactNode;
  required?: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * A consent or opt-in checkbox. G8 / POPIA: it is always unticked when it
 * first renders. There is deliberately no `checked` or `defaultChecked` prop.
 */
export function ConsentCheckbox({
  name,
  children,
  required,
  onChange,
}: ConsentProps) {
  return (
    <label className="cx-check">
      <input
        type="checkbox"
        name={name}
        required={required}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
      />
      <span className="cx-box" aria-hidden="true">
        <Icon name="check" size="sm" />
      </span>
      <span>{children}</span>
    </label>
  );
}

/**
 * One option in a group of radios or checkboxes, drawn with the Studio box
 * (a round box for radios). Never pre-ticked: use ConsentCheckbox for consent.
 */
export function Choice({
  type = "checkbox",
  name,
  value,
  required,
  children,
}: {
  type?: "checkbox" | "radio";
  name: string;
  value: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="cx-check">
      <input type={type} name={name} value={value} required={required} />
      <span
        className="cx-box"
        aria-hidden="true"
        {...(type === "radio" ? { style: { borderRadius: "999px" } } : {})}
      >
        <Icon name="check" size="sm" />
      </span>
      <span>{children}</span>
    </label>
  );
}
