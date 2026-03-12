/**
 * Centralized LogicMonitor domain configuration.
 * Supports both commercial (logicmonitor.com) and FedRAMP (lmgov.us) domains.
 */

const SUPPORTED_LM_DOMAINS = ['logicmonitor.com', 'lmgov.us'] as const;

/** Chrome match patterns for tabs.query, manifest permissions, etc. */
export const LM_URL_MATCH_PATTERNS: string[] = SUPPORTED_LM_DOMAINS.map(
  (d) => `https://*.${d}/*`
);

/** Returns true if the hostname belongs to a supported LogicMonitor domain. */
export function isLmDomain(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  return SUPPORTED_LM_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );
}

/** Returns true if the URL string contains a supported LogicMonitor domain. */
export function isLmUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return SUPPORTED_LM_DOMAINS.some((d) => url.includes(d));
}
