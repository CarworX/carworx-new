import { useState } from "react";
import { Form } from "react-router";

import { CsrfField } from "../auth/ui";
import { REVIEW_METHODS } from "../server/providers/forms";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import type { RailStep } from "../ui/StepRail";
import { Switch } from "../ui/Switch";
import { ReviewFlow } from "./ReviewFlow";

const STEPS: readonly RailStep[] = [
  { icon: "user", title: "Claim", body: "Read who is asking for access" },
  { icon: "doc", title: "Evidence", body: "Check the evidence yourself" },
  {
    icon: "lock",
    title: "Current access",
    body: "Understand who will lose access",
  },
  { icon: "shield", title: "Decision", body: "Transfer control or reject" },
  { icon: "check", title: "Confirm", body: "Check and save your decision" },
];

export function ClaimReview({
  csrf,
  claim,
}: {
  csrf: string;
  claim: {
    claimant: string;
    listing: string;
    organisation: string;
    evidence_kind: "business_email" | "document";
    email_domain: string | null;
    document_reference: string | null;
    activeMembers: number;
  };
}) {
  const [decision, setDecision] = useState("approve");
  return (
    <Form method="post" data-form={`${decision}-claim`}>
      <CsrfField token={csrf} />
      <ReviewFlow label="Claim review" steps={STEPS}>
        {[
          <p key="claim" className="type-body">
            {claim.claimant} wants to manage {claim.listing}.
          </p>,
          <div key="evidence" className="grid gap-4">
            <p className="type-body">
              {claim.evidence_kind === "business_email"
                ? `Confirmed sign-in email at ${claim.email_domain ?? ""}. Check that this domain belongs to the business.`
                : `Document reference: ${claim.document_reference ?? ""}. Review the document itself outside CarworX.`}
            </p>
            <div className="cx-field">
              <label htmlFor="claim-method">How did you check it?</label>
              <select
                id="claim-method"
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
          </div>,
          <div key="access" className="grid gap-3">
            <p className="type-body">
              {claim.organisation} currently has {claim.activeMembers} people
              with access.
            </p>
            <p className="type-body">
              Approving makes the claimant the owner and removes everyone else
              from the business. A displaced owner can still dispute the
              transfer.
            </p>
          </div>,
          <div key="decision" className="grid gap-4">
            <fieldset className="cx-field">
              <legend>What should happen?</legend>
              {[
                { value: "approve", label: "Approve: transfer control" },
                { value: "reject", label: "Reject: keep the current owner" },
              ].map((option) => (
                <label key={option.value} className="cx-check">
                  <input
                    type="radio"
                    name="intent"
                    value={option.value}
                    defaultChecked={option.value === "approve"}
                    onChange={() => setDecision(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <TextField
              label={decision === "approve" ? "Note (optional)" : "Why"}
              name="note"
              required={decision === "reject"}
              minLength={5}
              maxLength={500}
            />
          </div>,
          <div key="confirm" className="grid gap-4">
            <p className="type-body">
              {decision === "approve"
                ? `Transfer control of ${claim.organisation} to ${claim.claimant}.`
                : `Reject this claim and keep the current owner of ${claim.organisation}.`}
            </p>
            <Switch
              label="I checked this myself"
              name="review_confirmed"
              required
              hint="Your decision and review method are recorded in the audit log."
            />
            <div>
              <Button type="submit" variant="primary">
                {decision === "approve" ? "Approve claim" : "Reject claim"}
              </Button>
            </div>
          </div>,
        ]}
      </ReviewFlow>
    </Form>
  );
}
