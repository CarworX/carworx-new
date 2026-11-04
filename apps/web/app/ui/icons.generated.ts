// GENERATED from planning/design/brand/exports/studio/icons (sha256 f4173f4b2e02235116d2352f81982ebe242e1f975a59c45a880dfbe1f36d09b9).
// Do not edit. Run `pnpm --filter @carworx/web tokens` to regenerate.

export const ICON_NAMES = [
  "alert",
  "arrow",
  "back",
  "bay",
  "bell",
  "cal",
  "camera",
  "car",
  "check",
  "chev",
  "clock",
  "doc",
  "ext",
  "home",
  "info",
  "list",
  "lock",
  "map",
  "pin",
  "play",
  "refresh",
  "search",
  "shield",
  "star",
  "user",
] as const;
export type IconName = (typeof ICON_NAMES)[number];
export type IconNode =
  | ["path", { d: string; fill?: "currentColor"; stroke?: "none" }]
  | ["circle", { cx: number; cy: number; r: number }]
  | [
      "rect",
      { x: number; y: number; width: number; height: number; rx?: number },
    ];

export const ICONS: Record<IconName, readonly IconNode[]> = {
  alert: [
    ["path", { d: "M12 3.5L21.5 20h-19z" }],
    ["path", { d: "M12 10v4.5M12 17.2v.3" }],
  ],
  arrow: [["path", { d: "M4 12h15M13 6l6 6-6 6" }]],
  back: [["path", { d: "M15 5l-7 7 7 7" }]],
  bay: [
    ["path", { d: "M3 20V9l9-5 9 5v11" }],
    ["path", { d: "M7 20v-7h10v7" }],
  ],
  bell: [
    ["path", { d: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" }],
    ["path", { d: "M10 20.5a2 2 0 0 0 4 0" }],
  ],
  cal: [
    ["rect", { x: 4, y: 5.5, width: 16, height: 14.5, rx: 2 }],
    ["path", { d: "M4 10h16M8.5 3.5v4M15.5 3.5v4" }],
  ],
  camera: [
    ["path", { d: "M4 8h3.5L9 5.5h6L16.5 8H20v11H4z" }],
    ["circle", { cx: 12, cy: 13.5, r: 3.3 }],
  ],
  car: [
    ["path", { d: "M4 16v-3l2-5h12l2 5v3z" }],
    ["circle", { cx: 7.5, cy: 16.5, r: 1.8 }],
    ["circle", { cx: 16.5, cy: 16.5, r: 1.8 }],
  ],
  check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
  chev: [["path", { d: "M9 5l7 7-7 7" }]],
  clock: [
    ["circle", { cx: 12, cy: 12, r: 8.5 }],
    ["path", { d: "M12 7.5V12l3 2" }],
  ],
  doc: [
    ["path", { d: "M6 3h9l3 3v15H6z" }],
    ["path", { d: "M9 9h6M9 13h6M9 17h4" }],
  ],
  ext: [["path", { d: "M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" }]],
  home: [
    ["path", { d: "M4 11l8-6.5 8 6.5v9H4z" }],
    ["path", { d: "M10 20v-5h4v5" }],
  ],
  info: [
    ["circle", { cx: 12, cy: 12, r: 8.5 }],
    ["path", { d: "M12 11v5.5M12 7.8v.3" }],
  ],
  list: [
    ["path", { d: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" }],
  ],
  lock: [
    ["rect", { x: 5, y: 11, width: 14, height: 9, rx: 2 }],
    ["path", { d: "M8 11V8a4 4 0 0 1 8 0v3" }],
  ],
  map: [
    ["path", { d: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" }],
    ["path", { d: "M9 4v14M15 6v14" }],
  ],
  pin: [
    ["path", { d: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" }],
    ["circle", { cx: 12, cy: 9.5, r: 2.5 }],
  ],
  play: [["path", { d: "M8 5.5v13l11-6.5z" }]],
  refresh: [
    ["path", { d: "M19 8a7.5 7.5 0 1 0 1 6" }],
    ["path", { d: "M19.5 3.5V8H15" }],
  ],
  search: [
    ["circle", { cx: 11, cy: 11, r: 6.5 }],
    ["path", { d: "M16 16l4.5 4.5" }],
  ],
  shield: [
    ["path", { d: "M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z" }],
    ["path", { d: "M8.8 12.2l2.2 2.2 4.3-4.3" }],
  ],
  star: [
    [
      "path",
      {
        d: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z",
        fill: "currentColor",
        stroke: "none",
      },
    ],
  ],
  user: [
    ["circle", { cx: 12, cy: 8.5, r: 3.8 }],
    ["path", { d: "M4.5 20c1.2-4 4.2-5.8 7.5-5.8s6.3 1.8 7.5 5.8" }],
  ],
};
