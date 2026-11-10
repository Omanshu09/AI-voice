/** Exact origins, plus patterns like "https://*.vercel.app". */
export function isOriginAllowed(origin, allowed) {
  if (!origin) return true; // non-browser callers (health checks, curl)
  return allowed.some(rule => {
    if (rule === origin) return true;
    if (rule.includes("*.")) {
      const [scheme, host] = rule.split("://");
      try {
        const u = new URL(origin);
        const suffix = host.replace("*", "");
        return `${u.protocol}//` === `${scheme}://` && u.hostname.endsWith(suffix) && u.hostname.length > suffix.length;
      } catch { return false; }
    }
    return false;
  });
}
