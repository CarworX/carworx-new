import { useId, useRef, useState } from "react";

/** Join a phrase onto the text as its own sentence, if it fits and isn't there yet. */
export function addPhrase(text: string, phrase: string, max: number): string {
  const p = phrase.trim().replace(/[.!?]*$/, "");
  if (!p || text.includes(p)) return text;
  const t = text.trim();
  const base = !t ? "" : /[.!?]$/.test(t) ? `${t} ` : `${t}. `;
  const next = `${base}${p}.`;
  return next.length <= max ? next : text;
}

/**
 * The one short "about" line, with tap-to-add starter phrases so most people
 * don't need to type (pick, don't type; one of only two typed fields).
 */
export function StarterPhrases({
  label,
  hint,
  name,
  phrases,
  maxLength = 200,
  defaultValue = "",
}: {
  label: string;
  hint?: string;
  name: string;
  phrases: readonly string[];
  maxLength?: number;
  defaultValue?: string;
}) {
  const id = useId();
  const [text, setText] = useState(defaultValue);
  const area = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="cx-field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      ) : null}
      <div className="cx-picks" role="group" aria-label="Starter phrases">
        {phrases.map((p) => (
          <button
            key={p}
            type="button"
            className="cx-chip"
            aria-pressed={text.includes(p)}
            onClick={() => {
              setText((t) => addPhrase(t, p, maxLength));
              area.current?.focus();
            }}
          >
            + {p}
          </button>
        ))}
      </div>
      <textarea
        ref={area}
        id={id}
        name={name}
        className="cx-input"
        rows={3}
        maxLength={maxLength}
        value={text}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => {
          setText(e.currentTarget.value);
        }}
      />
      <span className="cx-count" aria-live="polite">
        {text.length} / {maxLength}
      </span>
    </div>
  );
}
