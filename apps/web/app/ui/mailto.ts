/** Encode address text without permitting mailto query parameters or fragments. */
export function mailtoHref(address: string): string {
  return `mailto:${encodeURIComponent(address).replaceAll("%40", "@")}`;
}
