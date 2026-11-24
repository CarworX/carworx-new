import type { ReactNode } from "react";

interface ResultCardProps {
  name: string;
  href: string;
  meta: string;
  /** Status labels: what was checked. Always words. */
  labels?: ReactNode;
  price: string;
  priceNote?: string;
  thumb: string;
}

/** One search result. The name is the link; labels state checked facts. */
export function ResultCard({
  name,
  href,
  meta,
  labels,
  price,
  priceNote,
  thumb,
}: ResultCardProps) {
  return (
    <article className="cx-result">
      <span className="th">
        <img src={thumb} alt="" width={44} height={44} />
      </span>
      <div>
        <h3>
          <a href={href}>{name}</a>
        </h3>
        <span className="m">{meta}</span>
        {labels ? <div className="lbls">{labels}</div> : null}
      </div>
      <div className="pr">
        {price}
        {priceNote ? <small>{priceNote}</small> : null}
      </div>
    </article>
  );
}
