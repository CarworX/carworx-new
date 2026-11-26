/**
 * Official referral links for fines (P2-6, A14, kept with the landing's fines
 * band, D-003). Only sites read and confirmed on the date shown; a link that
 * can't be confirmed is left out, not guessed. Each label names only what the
 * site itself says about who runs it.
 */
export const OFFICIAL_LINKS = [
  {
    href: "https://rtmc.co.za/",
    name: "Road Traffic Management Corporation (RTMC)",
    runBy:
      "The site identifies its operator as the Road Traffic Management Corporation.",
    use: "Official RTMC information and services; this is not a complete fines search.",
    checked: "2026-11-11",
  },
  {
    href: "https://www.rtia.co.za/",
    name: "Road Traffic Infringement Agency (RTIA)",
    runBy:
      "The RTIA says it is the only body legally authorised to administer and process fines under the AARTO Act.",
    use: "Its “Check your fines” button opens the official AARTO fine checker.",
    checked: "2026-11-11",
  },
] as const;
