import { useNavigate } from "react-router";

import { FilterBar, type BarOption } from "../ui/ScrollBar";

/** Route-backed filters retain ordinary links when JavaScript is unavailable. */
export function QueueFilters({
  label,
  options,
  value,
  base,
}: {
  label: string;
  options: readonly BarOption[];
  value: string;
  base: string;
}) {
  const navigate = useNavigate();
  const href = (status: string) =>
    `${base}?status=${encodeURIComponent(status)}`;
  return (
    <div className="mb-5">
      <FilterBar
        label={label}
        options={options}
        value={value}
        onChange={(status) => {
          void navigate(href(status));
        }}
      />
      <noscript>
        <nav aria-label={label} className="cx-filterbar">
          {options.map((option) => (
            <a
              key={option.value}
              className="cx-chip"
              href={href(option.value)}
              aria-current={option.value === value ? "page" : undefined}
            >
              {option.label}
            </a>
          ))}
        </nav>
      </noscript>
    </div>
  );
}
