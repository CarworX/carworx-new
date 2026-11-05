import { useEffect, useRef } from "react";

import { Lockup } from "../brand/Lockup";
import { ButtonLink, TextLink } from "../Button";
import { usePrefersReducedMotion } from "../motion";
import { SERVICES } from "../services";
import { startLens } from "./lens";

interface NotFoundProps {
  homeHref?: string;
  findHref?: string;
  serviceHref?: (key: (typeof SERVICES)[number]["key"]) => string;
  /** Force the reduced-motion still, e.g. on the living page. */
  still?: boolean;
  /** Heading level 1 on the real 404; 2 when shown inside another page. */
  embedded?: boolean;
}

/**
 * The CarworX 404 (D-041): the dot grid set as "404", the rotor as the 0 and
 * a glass loupe that follows the pointer. The copy is fixed by the brand book.
 */
export function NotFound({
  homeHref = "/",
  findHref = "/search",
  serviceHref = (k) => `/search?service=${k}`,
  still = false,
  embedded = false,
}: NotFoundProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion() || still;
  useEffect(() => {
    if (!root.current || !canvas.current || !slot.current) return;
    return startLens({
      root: root.current,
      canvas: canvas.current,
      slot: slot.current,
      reduced,
    });
  }, [reduced]);
  const H = embedded ? "h2" : "h1";
  const Main = embedded ? "div" : "main";
  return (
    <div ref={root} className="cx-404">
      <canvas ref={canvas} className="fx" aria-hidden="true" />
      <div className="page">
        <header className="head">
          <a className="brand" href={homeHref}>
            <Lockup title="CarworX home" />
          </a>
        </header>
        <Main className="main">
          <div ref={slot} className="slot" aria-hidden="true" />
          <p className="cx-eyebrow">Error 404 · page not found</p>
          <H>
            <span>We can&apos;t find that page.</span>
            <span className="grey">It may have moved.</span>
          </H>
          <p className="sub">
            Check the address for a typo, or start again from home.
          </p>
          <div className="act">
            <ButtonLink href={homeHref} arrow>
              Back to home
            </ButtonLink>
            <TextLink href={findHref}>Find a service</TextLink>
          </div>
        </Main>
        <nav className="svc" aria-label="Services">
          <p className="cx-eyebrow">Or go straight to</p>
          <ul>
            {SERVICES.map((s) => (
              <li key={s.key}>
                <a href={serviceHref(s.key)}>
                  <img src={s.object} alt="" width={30} height={30} />
                  <span>{s.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
