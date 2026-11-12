import { useState, useSyncExternalStore } from "react";
import { Form } from "react-router";

import { CsrfField } from "../auth/ui";
import { LABELS, REVIEW_METHODS } from "../server/providers/forms";
import { Button } from "../ui/Button";
import { Choice, TextField } from "../ui/Field";
import type { RailStep } from "../ui/StepRail";
import { Switch } from "../ui/Switch";
import { ReviewFlow } from "./ReviewFlow";

const STEPS: readonly RailStep[] = [
  { icon: "bay", title: "Business", body: "Read the business details" },
  { icon: "pin", title: "Location", body: "Check where customers are served" },
  { icon: "shield", title: "Checks", body: "Record your method and evidence" },
  { icon: "doc", title: "Decision", body: "Approve or send back" },
  { icon: "check", title: "Confirm", body: "Check and save your decision" },
];
const subscribe = () => () => {};
const yes = () => true;
const no = () => false;

export function ApplicationReview({
  csrf,
  business,
}: {
  csrf: string;
  business: {
    display_name: string;
    description: string;
    mode: "fixed" | "mobile" | "both";
    metro: string;
    address: string | null;
  };
}) {
  const [decision, setDecision] = useState("approve");
  const [labels, setLabels] = useState<string[]>([]);
  const ready = useSyncExternalStore(subscribe, yes, no);
  return (
    <Form method="post" data-form={decision}>
      <CsrfField token={csrf} />
      <input type="hidden" name="intent" value="decide" />
      <ReviewFlow label="Application review" steps={STEPS}>
        {[
          <div key="business" className="grid gap-3">
            <p className="type-title">{business.display_name}</p>
            <p className="type-body whitespace-pre-line">
              {business.description}
            </p>
            <p className="type-caption">
              Check that the business and the services it offers are genuine.
            </p>
          </div>,
          <div key="location" className="grid gap-3">
            <p className="type-body">
              {business.mode === "mobile"
                ? `Comes to customers in ${business.metro}.`
                : `${business.address ?? "No public address"} · ${business.metro}`}
            </p>
            {business.mode === "both" ? (
              <p className="type-body">Also comes to customers.</p>
            ) : null}
            <p className="type-caption">
              A service area is kept private. A premises visit label is
              available only for a business with premises.
            </p>
          </div>,
          <div key="checks" className="grid gap-4">
            <div className="cx-field">
              <label htmlFor="application-method">How did you check it?</label>
              <select
                id="application-method"
                name="method"
                className="cx-input"
                required={decision === "approve"}
              >
                {REVIEW_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset
              className="cx-field"
              onChange={(event) => {
                const input = event.target as HTMLInputElement;
                setLabels((before) =>
                  input.checked
                    ? [...before, input.value]
                    : before.filter((value) => value !== input.value),
                );
              }}
            >
              <legend>Labels to show</legend>
              {LABELS.filter(
                (label) =>
                  business.mode !== "mobile" ||
                  label.value !== "premises_visited",
              ).map((label) => (
                <Choice key={label.value} name="labels" value={label.value}>
                  {label.label}
                </Choice>
              ))}
            </fieldset>
            <TextField
              label="Evidence reference (needed with any label)"
              name="evidence"
              minLength={3}
              maxLength={200}
              required={decision === "approve" && labels.length > 0}
              hint="Where the evidence is kept. Never paste ID numbers or documents."
            />
          </div>,
          <div key="decision" className="grid gap-4">
            <fieldset className="cx-field">
              <legend>What should happen?</legend>
              {[
                { value: "approve", label: "Approve and publish" },
                { value: "reject", label: "Send back to the provider" },
              ].map((option) => (
                <label key={option.value} className="cx-check">
                  <input
                    type="radio"
                    name="decision"
                    value={option.value}
                    defaultChecked={option.value === "approve"}
                    onChange={() => {
                      setDecision(option.value);
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <div hidden={ready && decision !== "reject"}>
              <TextField
                label="What the provider needs to change"
                name="reason"
                required={decision === "reject"}
                minLength={5}
                maxLength={500}
              />
            </div>
          </div>,
          <div key="confirm" className="grid gap-4">
            <p className="type-body">
              {decision === "approve"
                ? `${business.display_name} will be published with the labels you selected.`
                : `${business.display_name} will be returned with your reason so the provider can make changes.`}
            </p>
            <Switch
              label="I checked this myself"
              name="review_confirmed"
              required
              hint="Your decision and review method are recorded in the audit log."
            />
            <div>
              <Button type="submit" variant="primary">
                {decision === "approve"
                  ? "Approve and publish"
                  : "Send back to the provider"}
              </Button>
            </div>
          </div>,
        ]}
      </ReviewFlow>
    </Form>
  );
}
