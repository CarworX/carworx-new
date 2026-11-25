import { Lockup } from "../brand/Lockup";
import { GET_LISTED } from "./SiteHeader";

/** The site footer on every public page (redesign A1). One set of links. */
export function SiteFooter() {
  return (
    <footer className="cx-footer">
      <div className="in">
        <a className="logo" href="/">
          <Lockup title="CarworX home" />
        </a>
        <nav aria-label="Footer">
          <a href="/#services">Find a service</a>
          <a href="/#fines">Fines</a>
          <a href="/#business">For businesses</a>
          <a href={GET_LISTED}>List your business</a>
          <a href="/support">Contact support</a>
        </nav>
        <p className="fine">
          <span>carworx.app · South Africa</span>
          <span>
            <a href="/support">Contact support</a> ·{" "}
            <a href="/privacy">Privacy</a> · <a href="/terms">Terms of use</a>
          </span>
        </p>
      </div>
    </footer>
  );
}
