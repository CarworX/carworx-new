import { Icon } from "./Icon";
import { keepAmp, SERVICES } from "./services";

export interface ServiceLinks {
  /** The five links, in the fixed order of SERVICES. */
  hrefs: Record<(typeof SERVICES)[number]["key"], string>;
  hints?: Partial<Record<(typeof SERVICES)[number]["key"], string>>;
}

/** The five key-caps: the product's front door. Nothing else sits inside. */
export function ServiceKeys({ hrefs, hints = {} }: ServiceLinks) {
  return (
    <ul className="cx-keys">
      {SERVICES.map((s, i) => (
        <li key={s.key}>
          <a className="cx-key" href={hrefs[s.key]}>
            <span className="obj">
              <img src={s.object} alt="" width={68} height={68} />
            </span>
            <span className="n" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <b>{keepAmp(s.label)}</b>
              {hints[s.key] ? <small>{hints[s.key]}</small> : null}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The phone version: five 60 px rows in one column. */
export function ServiceKeyRows({ hrefs, hints = {} }: ServiceLinks) {
  return (
    <ul className="grid gap-2">
      {SERVICES.map((s) => (
        <li key={s.key}>
          <a className="cx-keyrow" href={hrefs[s.key]}>
            <span className="obj">
              <img src={s.object} alt="" width={46} height={46} />
            </span>
            <span>
              <b>{keepAmp(s.label)}</b>
              {hints[s.key] ? <small>{hints[s.key]}</small> : null}
            </span>
            <Icon name="chev" />
          </a>
        </li>
      ))}
    </ul>
  );
}
