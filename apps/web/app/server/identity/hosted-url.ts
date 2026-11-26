export function isHostedDiditSession(url: URL): boolean {
  return (
    url.origin === "https://verify.didit.me" &&
    !url.username &&
    !url.password &&
    /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?session\/[A-Za-z0-9_-]+\/?$/.test(
      url.pathname,
    )
  );
}
