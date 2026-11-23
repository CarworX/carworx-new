import { data, Form } from "react-router";

import { cataloguePage } from "../server/search/catalogue-page.server";
import { SITES_LINKS, SitesShell } from "../sites/SitesShell";
import { whereText } from "../ui/public/ListingResult";
import type { Route } from "./+types/provider.get-listed.claim";

const PICKER = "/provider/get-listed/claim";
const APPLICATION = "/provider/get-listed/business";

export const links: Route.LinksFunction = () => [...SITES_LINKS];
export const meta: Route.MetaFunction = () => [
  { title: "Find your business · CarworX" },
  { name: "robots", content: "noindex" },
];
export const headers: Route.HeadersFunction = ({ loaderHeaders }) =>
  loaderHeaders;

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  // Use the no-location catalogue search and its signed pagination.
  for (const key of Array.from(url.searchParams.keys())) {
    if (key !== "q" && key !== "all_cursor") url.searchParams.delete(key);
  }
  const { model, cookie } = await cataloguePage(
    new Request(url, request),
    context.cloudflare.env,
  );
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  if (model.kind === "rate_limited") {
    headers.set("Retry-After", String(model.retryAfterSeconds));
    return data({ model }, { status: 429, headers });
  }
  const status =
    model.kind === "browse"
      ? 200
      : model.kind === "invalid_words" || model.kind === "bad_request"
        ? 400
        : 503;
  return data({ model }, { status, headers });
}

export default function ClaimPicker({ loaderData }: Route.ComponentProps) {
  const { model } = loaderData;
  const results = model.kind === "browse" ? (model.body.all?.items ?? []) : [];
  const problem =
    model.kind === "browse"
      ? null
      : model.kind === "rate_limited"
        ? "Too many searches. Wait a moment and try again."
        : model.kind === "invalid_words"
          ? "Enter a shorter business name and try again."
          : model.kind === "bad_request"
            ? "Start a new search using your business name."
            : "Search is temporarily unavailable. Please try again.";
  const more =
    model.kind === "browse" && model.moreAll
      ? `${PICKER}${model.moreAll.slice("/search".length)}`
      : null;

  return (
    <SitesShell>
      <h1 className="title">Find your business</h1>
      <p className="lead">
        Find your existing listing and ask to manage it. CarworX reviews every
        claim.
      </p>
      <Form className="card" action={PICKER} role="search">
        <label htmlFor="claim-business-name">Business name</label>
        <div className="searchbox">
          <input
            id="claim-business-name"
            name="q"
            type="search"
            maxLength={60}
            enterKeyHint="search"
            defaultValue={"q" in model ? model.q : ""}
            aria-describedby={problem ? "claim-search-problem" : undefined}
          />
          <button className="btn" type="submit">
            Find business
          </button>
        </div>
      </Form>
      {problem ? (
        <p id="claim-search-problem" role="status">
          {problem}
        </p>
      ) : results.length === 0 ? (
        <p>No listings found. Try another name or start a new application.</p>
      ) : (
        <ul aria-label="Matching listings" className="list-none pl-0">
          {results.map((listing) => (
            <li className="card" key={listing.public_id}>
              <h2>{listing.display_name}</h2>
              <p>
                {whereText(listing, false)} · {listing.service_name}
              </p>
              <a
                className="btn"
                href={`/provider/claim/${listing.public_id}`}
                aria-label={`Claim ${listing.display_name}`}
              >
                Claim this listing
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="bar">
        {more ? (
          <a className="btn secondary" href={more}>
            More businesses
          </a>
        ) : null}
        <a className="btn secondary" href={APPLICATION}>
          List a new business
        </a>
      </div>
    </SitesShell>
  );
}
