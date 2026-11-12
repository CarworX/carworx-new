import { useId, type ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

interface BaseProps {
  /** The question, as the fieldset's visible legend. */
  legend: string;
  hint?: string;
  error?: string;
  name: string;
  /** Pick all that apply (checkboxes) instead of one (radios). */
  multiple?: boolean;
  required?: boolean;
  /** Uncontrolled default: one value, or several when multiple. */
  defaultValue?: string | readonly string[];
  onChange?: (value: string, checked: boolean) => void;
}

function useLegend(hint?: string, error?: string) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return { hintId, errId, describedBy };
}

function isDefault(dv: BaseProps["defaultValue"], v: string) {
  return Array.isArray(dv) ? dv.includes(v) : dv === v;
}

function Extras({
  hint,
  error,
  hintId,
  errId,
}: {
  hint?: string;
  error?: string;
  hintId?: string;
  errId?: string;
}) {
  return (
    <>
      {hint ? (
        <span id={hintId} className="hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errId} className="error" role="alert">
          <Icon name="alert" size="sm" />
          {error}
        </span>
      ) : null}
    </>
  );
}

export interface TileOption {
  value: string;
  title: string;
  description?: string;
  icon?: IconName;
}

/**
 * Big choice tiles, one or several ("They come to me" / "I go to them").
 * Native inputs inside labels give real radio or checkbox semantics.
 */
export function ChoiceTiles({
  options,
  ...p
}: BaseProps & { options: readonly TileOption[] }) {
  const { hintId, errId, describedBy } = useLegend(p.hint, p.error);
  return (
    <fieldset className="cx-field cx-choice" aria-describedby={describedBy}>
      <legend className="lbl">{p.legend}</legend>
      <Extras hint={p.hint} error={p.error} hintId={hintId} errId={errId} />
      <div className="cx-tiles">
        {options.map((o) => (
          <label
            key={o.value}
            className={`cx-tile-pick${p.multiple ? " multi" : ""}`}
          >
            <input
              type={p.multiple ? "checkbox" : "radio"}
              name={p.name}
              value={o.value}
              required={p.required && !p.multiple}
              defaultChecked={isDefault(p.defaultValue, o.value)}
              onChange={(e) => p.onChange?.(o.value, e.currentTarget.checked)}
            />
            {o.icon ? (
              <span className="ic" aria-hidden="true">
                <Icon name={o.icon} size="lg" />
              </span>
            ) : null}
            <b>{o.title}</b>
            {o.description ? <small>{o.description}</small> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface PickOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * Chips you pick, which wrap onto new lines (setup questions keep wrapping;
 * only filter and tab bars scroll sideways). One, or several with ticks.
 */
export function PickChips({
  options,
  ...p
}: BaseProps & { options: readonly PickOption[] }) {
  const { hintId, errId, describedBy } = useLegend(p.hint, p.error);
  return (
    <fieldset className="cx-field cx-choice" aria-describedby={describedBy}>
      <legend className="lbl">{p.legend}</legend>
      <Extras hint={p.hint} error={p.error} hintId={hintId} errId={errId} />
      <div className="cx-picks">
        {options.map((o) => (
          <label
            key={o.value}
            className={`cx-pick${p.multiple ? " multi" : ""}`}
          >
            <input
              type={p.multiple ? "checkbox" : "radio"}
              name={p.name}
              value={o.value}
              disabled={o.disabled}
              required={p.required && !p.multiple}
              defaultChecked={isDefault(p.defaultValue, o.value)}
              onChange={(e) => p.onChange?.(o.value, e.currentTarget.checked)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
