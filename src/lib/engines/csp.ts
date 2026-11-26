/** Only explicit HTTPS origins are accepted; never interpolate arbitrary CSP directives. */
export function cspOrigins(value: string): string[] {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => {
      const url = new URL(entry);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        !/^[a-z0-9.-]+$/i.test(url.hostname)
      )
        throw new Error("CSP_CONNECT_ORIGINS must contain space-separated HTTPS origins");
      return url.origin;
    });
}
export function contentSecurityPolicy(nonce: string, development: boolean, extraConnect = "") {
  if (!/^[A-Za-z0-9+/_=-]{16,128}$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://checkout.razorpay.com${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    // Theme tokens and React inline style attributes are intentionally supported.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://tagmanager.google.com",
    "img-src 'self' https: data: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.google.com https://*.googleadservices.com https://*.doubleclick.net https://www.facebook.com https://graph.facebook.com https://connect.facebook.net https://*.razorpay.com https://*.stripe.com https://*.daily.co wss://*.daily.co ${cspOrigins(extraConnect).join(" ")}${development ? " ws: wss:" : ""}`,
    "media-src 'self' https: data: blob:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}
