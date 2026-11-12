import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "../ui/Button";
import { SegmentedProgress } from "../ui/SegmentedProgress";
import { StepRail, type RailStep } from "../ui/StepRail";

// A selector spanning input/select/textarea uses their shared browser contract.
interface ValidatableControl extends HTMLElement {
  checkValidity(): boolean;
  reportValidity(): boolean;
}

const subscribe = () => () => {};
const yes = () => true;
const no = () => false;

/** All fields stay mounted in one form. Without JS every step is visible. */
export function ReviewFlow({
  label,
  steps,
  children,
}: {
  label: string;
  steps: readonly RailStep[];
  children: readonly ReactNode[];
}) {
  const [step, setStep] = useState(0);
  const ready = useSyncExternalStore(subscribe, yes, no);
  const host = useRef<HTMLDivElement>(null);
  const move = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => {
      host.current
        ?.querySelector<HTMLElement>(`[data-review-step="${String(next)}"] h2`)
        ?.focus();
    });
  };
  const next = () => {
    const panel = host.current?.querySelector<HTMLElement>(
      `[data-review-step="${String(step)}"]`,
    );
    const controls =
      panel?.querySelectorAll<ValidatableControl>("input, select, textarea") ??
      [];
    for (const control of controls) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return;
      }
    }
    move(step + 1);
  };
  return (
    <div
      ref={host}
      className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]"
      onInvalidCapture={(event) => {
        // Browser validation may find a field in a previous, hidden step.
        // Reveal it before focusing; never lose the other form values.
        const input = event.target as HTMLInputElement;
        const panel = input.closest<HTMLElement>("[data-review-step]");
        if (panel && panel.hidden) {
          event.preventDefault();
          setStep(Number(panel.dataset.reviewStep));
          requestAnimationFrame(() => {
            input.focus();
            input.reportValidity();
          });
        }
      }}
    >
      <aside className="hidden lg:block">
        <StepRail label={label} steps={steps} current={step} />
      </aside>
      <div className="min-w-0 max-w-[65ch]">
        <SegmentedProgress
          label={label}
          name={steps[step].title}
          step={step}
          total={steps.length}
        />
        {steps.map((item, index) => (
          <section
            key={item.title}
            data-review-step={index}
            hidden={ready && index !== step}
            className="mt-6 grid gap-4"
          >
            <h2 className="type-title" tabIndex={-1}>
              {item.title}
            </h2>
            {children[index]}
          </section>
        ))}
        {ready ? (
          <nav aria-label={`${label} steps`} className="mt-6 flex gap-3">
            {step > 0 ? (
              <Button
                onClick={() => {
                  move(step - 1);
                }}
              >
                Back
              </Button>
            ) : null}
            {step < steps.length - 1 ? (
              <Button variant="primary" onClick={next}>
                Continue
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
