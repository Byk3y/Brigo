/**
 * URL Security Validation
 * SSRF (Server-Side Request Forgery) Prevention
 *
 * Phase A: added DNS resolution check to close the DNS rebinding gap.
 * Hostnames like 127.0.0.1.nip.io resolve to 127.0.0.1 but pass the
 * string-based hostname checks. validateUrlSecurityWithDns() resolves the
 * hostname and validates the resulting IP address.
 */

import type { UrlValidationResult } from './types.ts';

/**
 * Check whether an IPv4 address (as four octets) is private/reserved.
 * Extracted so both the hostname-string check and DNS-resolution check
 * share the same logic.
 */
function isPrivateIPv4(a: number, b: number, c: number, d: number): string | null {
  if (a > 255 || b > 255 || c > 255 || d > 255) {
    return 'Invalid IP address format.';
  }
  if (a === 10) return 'Private network IPs (10.x.x.x) are not allowed.';
  if (a === 172 && b >= 16 && b <= 31) return 'Private network IPs (172.16-31.x.x) are not allowed.';
  if (a === 192 && b === 168) return 'Private network IPs (192.168.x.x) are not allowed.';
  if (a === 169 && b === 254) return 'Link-local and cloud metadata endpoints are not allowed.';
  if (a === 127) return 'Loopback addresses are not allowed.';
  if (a === 255 && b === 255 && c === 255 && d === 255) return 'Broadcast addresses are not allowed.';
  if (a === 0) return 'Reserved IP range is not allowed.';
  return null;
}

/**
 * SECURITY: Validate URL to prevent SSRF attacks (synchronous, string-only).
 * Blocks:
 * - Non-HTTP(S) protocols (file://, javascript:, data:, etc.)
 * - Localhost and loopback addresses
 * - Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
 * - Cloud metadata endpoints (169.254.169.254)
 * - Link-local addresses
 *
 * NOTE: This check alone is vulnerable to DNS rebinding (e.g.
 * 127.0.0.1.nip.io). Use validateUrlSecurityWithDns() for server-side
 * checks where async is available.
 */
export function validateUrlSecurity(urlString: string): UrlValidationResult {
  try {
    const url = new URL(urlString);

    // 1. Block non-HTTP(S) protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        allowed: false,
        reason: `Protocol "${url.protocol}" not allowed. Only HTTP/HTTPS URLs are supported.`,
      };
    }

    const hostname = url.hostname.toLowerCase();

    // 2. Block localhost and loopback addresses
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      return {
        allowed: false,
        reason: 'Localhost and local network URLs are not allowed for security reasons.',
      };
    }

    // 3. Check if it's an IP address and validate
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Pattern);

    if (ipMatch) {
      const [, a, b, c, d] = ipMatch.map(Number);
      const reason = isPrivateIPv4(a, b, c, d);
      if (reason) return { allowed: false, reason };
    }

    // 4. Block IPv6 private/local addresses
    if (hostname.startsWith('[')) {
      const ipv6 = hostname.slice(1, -1).toLowerCase();
      if (
        ipv6 === '::1' ||
        ipv6.startsWith('fe80:') ||
        ipv6.startsWith('fc') ||
        ipv6.startsWith('fd')
      ) {
        return { allowed: false, reason: 'Private/local IPv6 addresses are not allowed.' };
      }
    }

    // 5. Block common internal service hostnames
    const blockedHostPatterns = [
      /^internal\./i,
      /^intranet\./i,
      /^admin\./i,
      /^metadata\./i,
      /\.internal$/i,
      /\.corp$/i,
      /\.lan$/i,
    ];

    for (const pattern of blockedHostPatterns) {
      if (pattern.test(hostname)) {
        return { allowed: false, reason: 'Internal/corporate hostnames are not allowed.' };
      }
    }

    // URL passed all string-based security checks
    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL.',
    };
  }
}

/**
 * SECURITY: Validate URL with DNS resolution to prevent SSRF via DNS
 * rebinding.
 *
 * This is the preferred check for server-side use (edge functions). It
 * first runs all the string-based checks from validateUrlSecurity(), then
 * resolves the hostname via Deno.resolveDns() and validates every
 * returned IP against the private/reserved ranges.
 *
 * This closes the DNS rebinding gap where a hostname like
 * 127.0.0.1.nip.io passes string checks but resolves to 127.0.0.1.
 */
export async function validateUrlSecurityWithDns(
  urlString: string
): Promise<UrlValidationResult> {
  // Run string-based checks first (fast, catches obvious cases)
  const stringCheck = validateUrlSecurity(urlString);
  if (!stringCheck.allowed) return stringCheck;

  // If the hostname is already a raw IP, string check handled it
  const url = new URL(urlString);
  const hostname = url.hostname.toLowerCase();
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Pattern.test(hostname)) {
    return stringCheck; // Already validated the IP in string check
  }

  // Resolve hostname to IP addresses and validate each one
  try {
    const ips = await Deno.resolveDns(hostname, 'A');

    for (const ip of ips) {
      const match = ip.match(ipv4Pattern);
      if (match) {
        const [, a, b, c, d] = match.map(Number);
        const reason = isPrivateIPv4(a, b, c, d);
        if (reason) {
          return {
            allowed: false,
            reason: `DNS resolution for "${hostname}" returned private IP ${ip}. ${reason}`,
          };
        }
      }
    }

    // Also check AAAA records for IPv6
    try {
      const ipv6s = await Deno.resolveDns(hostname, 'AAAA');
      for (const ip of ipv6s) {
        const lower = ip.toLowerCase();
        if (
          lower === '::1' ||
          lower.startsWith('fe80:') ||
          lower.startsWith('fc') ||
          lower.startsWith('fd')
        ) {
          return {
            allowed: false,
            reason: `DNS resolution for "${hostname}" returned private IPv6 ${ip}. Private/local IPv6 addresses are not allowed.`,
          };
        }
      }
    } catch {
      // No AAAA records is fine — many domains are IPv4-only
    }

    return { allowed: true };
  } catch (dnsError: any) {
    // DNS resolution failed — the hostname doesn't exist or DNS is down.
    // Fail closed: if we can't resolve the host, we shouldn't fetch it.
    return {
      allowed: false,
      reason: `Could not resolve hostname "${hostname}". Please check the URL and try again.`,
    };
  }
}
