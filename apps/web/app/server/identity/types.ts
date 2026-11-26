export type IdentityStatus = {
  state: "none" | "checking" | "approved" | "declined" | "in_review" | "locked";
  reason?: string;
  triesLeft: number;
  decidedAt?: string;
};
