/**
 * Thin typed wrapper over the K5 review RPCs and RLS reads (B-23). Every call
 * runs through the request's Supabase client, so RLS and the RPCs' own checks
 * decide what a caller may do. Postgres errors become plain outcomes here;
 * nothing in this module reads or writes tables directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Review, ReviewReply } from "../../reviews/model";
export {
  parseReviewSort,
  ratingBreakdown,
  REVIEW_SORTS,
  sortReviews,
  type ReviewSort,
} from "../../reviews/model";
export type { Review, ReviewReply } from "../../reviews/model";

/** Postgres codes the K5 RPCs raise: 42501 not_allowed, 22023 invalid input. */
export type ReviewFailure = "not_allowed" | "invalid" | "unavailable";
export type ReviewOutcome<T> =
  { ok: true; value: T } | { ok: false; reason: ReviewFailure };

export interface OwnReview {
  id: string;
  rating: number;
  body: string;
  service_slug: string | null;
  status: string;
  created_at: string;
  edited_at: string | null;
}

/** A Postgres error's code, if the error has one. Narrowed, never trusted. */
function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  const code = error.code;
  return typeof code === "string" ? code : undefined;
}

export function reviewOutcomeOf(error: unknown): {
  ok: false;
  reason: ReviewFailure;
} {
  const code = codeOf(error);
  if (code === "42501") return { ok: false, reason: "not_allowed" };
  if (code === "22023") return { ok: false, reason: "invalid" };
  return { ok: false, reason: "unavailable" };
}

/** Plain-language line for a failed review action, as the page shows it. */
export function reviewFailureText(reason: ReviewFailure): string {
  if (reason === "not_allowed")
    return "Only customers who contacted this business can review it.";
  if (reason === "invalid")
    return "Check the highlighted fields and try again.";
  return "We couldn't save that just now. Try again in a moment.";
}

type RpcResult = { data: unknown; error: unknown };

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function canReview(
  supabase: SupabaseClient,
  listing: string,
): Promise<ReviewOutcome<boolean>> {
  const result: RpcResult = await supabase.rpc("can_review", {
    p_listing: listing,
  });
  if (result.error) return reviewOutcomeOf(result.error);
  return { ok: true, value: result.data === true };
}

export async function myReview(
  supabase: SupabaseClient,
  listing: string,
): Promise<ReviewOutcome<OwnReview | null>> {
  const result: RpcResult = await supabase.rpc("my_review", {
    p_listing: listing,
  });
  if (result.error) return reviewOutcomeOf(result.error);
  const [first] = rows(result.data);
  return { ok: true, value: first ? (first as OwnReview) : null };
}

export interface ReviewInput {
  listing: string;
  rating: number;
  body: string;
  service: string | null;
}

/** Create or edit the caller's one review for a listing. */
export async function saveReview(
  supabase: SupabaseClient,
  input: ReviewInput,
): Promise<ReviewOutcome<string>> {
  const result: RpcResult = await supabase.rpc("upsert_review", {
    p_listing: input.listing,
    p_rating: input.rating,
    p_body: input.body,
    p_service: input.service,
  });
  if (result.error) return reviewOutcomeOf(result.error);
  return { ok: true, value: String(result.data) };
}

/** Public, visible reviews for a listing, with their owner replies. */
export async function listReviews(
  supabase: SupabaseClient,
  listing: string,
): Promise<ReviewOutcome<Review[]>> {
  const result: RpcResult = await supabase
    .from("reviews")
    .select(
      "id,listing_public_id,author_display,rating,body,service_slug,created_at,edited_at",
    )
    .eq("listing_public_id", listing)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(200);
  if (result.error) return reviewOutcomeOf(result.error);
  const reviews = rows(result.data) as Omit<Review, "reply">[];
  const replies = await repliesFor(
    supabase,
    reviews.map((r) => r.id),
  );
  if (!replies.ok) return replies;
  return {
    ok: true,
    value: reviews.map((r) => ({
      ...r,
      reply: replies.value.get(r.id) ?? null,
    })),
  };
}

async function repliesFor(
  supabase: SupabaseClient,
  ids: string[],
): Promise<ReviewOutcome<Map<string, ReviewReply>>> {
  const out = new Map<string, ReviewReply>();
  if (ids.length === 0) return { ok: true, value: out };
  const result: RpcResult = await supabase
    .from("review_replies")
    .select("review_id,body,created_at,edited_at")
    .in("review_id", ids);
  if (result.error) return reviewOutcomeOf(result.error);
  for (const row of rows(result.data) as (ReviewReply & {
    review_id: string;
  })[])
    out.set(row.review_id, {
      body: row.body,
      created_at: row.created_at,
      edited_at: row.edited_at,
    });
  return { ok: true, value: out };
}

export async function deleteMyReview(
  supabase: SupabaseClient,
  id: string,
): Promise<ReviewOutcome<true>> {
  const result: RpcResult = await supabase.rpc("delete_my_review", {
    p_id: id,
  });
  if (result.error) return reviewOutcomeOf(result.error);
  return { ok: true, value: true };
}

/** One public reply per review; the owner or a manager, with org MFA. */
export async function replyToReview(
  supabase: SupabaseClient,
  id: string,
  body: string,
): Promise<ReviewOutcome<true>> {
  const result: RpcResult = await supabase.rpc("reply_to_review", {
    p_id: id,
    p_body: body,
  });
  if (result.error) return reviewOutcomeOf(result.error);
  return { ok: true, value: true };
}

export async function reportReview(
  supabase: SupabaseClient,
  id: string,
  reason: string,
): Promise<ReviewOutcome<true>> {
  const result: RpcResult = await supabase.rpc("report_review", {
    p_id: id,
    p_reason: reason,
  });
  if (result.error) return reviewOutcomeOf(result.error);
  return { ok: true, value: true };
}
