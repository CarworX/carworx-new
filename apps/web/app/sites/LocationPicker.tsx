import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { LocationCandidate } from "../server/geo/geocode";

const subscribe = () => () => undefined;

export function LocationPicker({ id }: { id: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<LocationCandidate[]>([]);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onSubmit = (event: SubmitEvent) => {
      if (!text.trim()) return;
      event.preventDefault();
      setDismissed(false);
      input.current?.focus();
      if (text.trim().length < 3)
        setMessage("Enter at least three characters.");
      else if (!suggestions.length) setRetry((value) => value + 1);
      else setMessage("Choose a location from the suggestions.");
    };
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("submit", onSubmit);
    };
  }, [text, suggestions.length]);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 3 || dismissed) return;
    const controller = new AbortController();
    const options = { signal: controller.signal, cache: "no-store" } as const;
    const timer = setTimeout(() => {
      setMessage("Finding locations…");
      void (async () => {
        try {
          const session = await fetch("/api/location", options);
          if (!session.ok) throw new Error("Location session unavailable");
          const { csrf } = await session.json<{ csrf: string }>();
          const response = await fetch("/api/location", {
            ...options,
            method: "POST",
            body: new URLSearchParams({ csrf, location: query }),
          });
          if (!response.ok) {
            setMessage(
              response.status === 429
                ? "Too many lookups. Wait a moment and try again."
                : "Location suggestions are unavailable. You can still search without a location.",
            );
            return;
          }
          const { candidates } = await response.json<{
            candidates: LocationCandidate[];
          }>();
          if (controller.signal.aborted) return;
          setSuggestions(candidates);
          setMessage(
            candidates.length
              ? ""
              : "No locations found. Try a nearby town or check the spelling.",
          );
        } catch {
          if (!controller.signal.aborted)
            setMessage("Location suggestions are unavailable. Try again.");
        }
      })();
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, dismissed, retry]);

  function select(candidate: LocationCandidate) {
    const form = input.current?.form;
    if (!form) return;
    for (const [name, value] of Object.entries({
      lat: candidate.lat,
      lng: candidate.lng,
      near: candidate.locality,
    })) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = String(value);
    }
    // The exact address belongs only in the POST body and the suggestion list.
    form.submit();
  }

  const visible = !dismissed && suggestions.length > 0;
  return (
    <div className="relative min-w-0">
      <input
        id={id}
        ref={input}
        disabled={!hydrated}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={
          visible && active >= 0 ? `${listId}-${String(active)}` : undefined
        }
        value={text}
        maxLength={80}
        autoComplete="off"
        placeholder="Street address, suburb or town"
        onFocus={() => {
          setDismissed(false);
        }}
        onChange={(event) => {
          setText(event.currentTarget.value);
          setSuggestions([]);
          setActive(-1);
          setDismissed(false);
          setMessage("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setDismissed(true);
          if (
            visible &&
            (event.key === "ArrowDown" || event.key === "ArrowUp")
          ) {
            event.preventDefault();
            const offset = event.key === "ArrowDown" ? 1 : -1;
            setActive((index) =>
              index < 0
                ? offset === 1
                  ? 0
                  : suggestions.length - 1
                : (index + offset + suggestions.length) % suggestions.length,
            );
          }
          if (visible && event.key === "Enter") {
            const current = suggestions[active];
            if (current) {
              event.preventDefault();
              select(current);
            }
          }
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="South African locations"
        hidden={!visible}
        className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-[var(--control-edge)] bg-[var(--surface)] p-1 text-left shadow-lg"
      >
        {suggestions.map((candidate, index) => (
          <li
            key={`${candidate.label}-${String(index)}`}
            role="option"
            id={`${listId}-${String(index)}`}
            aria-selected={index === active}
            className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--canvas)] aria-selected:bg-[var(--canvas)]"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              select(candidate);
            }}
          >
            {candidate.label}
          </li>
        ))}
      </ul>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <noscript>
        <a href="/search/location">Search by address or town</a>
      </noscript>
    </div>
  );
}
