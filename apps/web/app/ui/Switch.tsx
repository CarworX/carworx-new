import { useId } from "react";

/** A yes/no toggle (role="switch" on a real checkbox), with a label and hint. */
export function Switch({
  label,
  hint,
  name,
  value = "yes",
  defaultChecked,
  required,
  onChange,
}: {
  label: string;
  hint?: string;
  name: string;
  value?: string;
  defaultChecked?: boolean;
  required?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="cx-switch" htmlFor={id}>
      <span className="txt">
        <span className="t">{label}</span>
        {hint ? (
          <span id={`${id}-hint`} className="h">
            {hint}
          </span>
        ) : null}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
      />
      <span className="track" aria-hidden="true" />
    </label>
  );
}
