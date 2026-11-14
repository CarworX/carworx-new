import { topCategoryOf } from "../catalogue/taxonomy";
import { whereText, type ListingSummary } from "../ui/public/ListingResult";
import { SERVICES } from "../ui/services";

/**
 * One listing as the preview's search result card (app.js `search()`):
 * object icon, check tags, name, place, then the service and "View business".
 */
export function ListingCard({
  listing,
  matched = false,
}: {
  listing: ListingSummary;
  matched?: boolean;
}) {
  const key = topCategoryOf(listing.category_slug)?.key ?? "repairs";
  const icon = SERVICES.find((s) => s.key === key)?.object ?? "";
  return (
    <article className="card">
      <div className="between">
        <div className="row">
          <img className="big-icon" src={icon} alt="" />
          <div>
            {listing.verification_labels.map((label) => (
              <span key={label} className="tag green">
                {label}
              </span>
            ))}
            <h2>{listing.display_name}</h2>
            <p className="muted">{whereText(listing, matched)}</p>
          </div>
        </div>
        <span className="price">Free to enquire</span>
      </div>
      <hr className="rule" />
      <p>{listing.service_name} · Opening hours and checks on the listing.</p>
      <div className="bar">
        <a className="btn" href={`/p/${listing.public_id}`}>
          View business →
        </a>
        <span className="small muted">
          The business replies to you directly
        </span>
      </div>
    </article>
  );
}
