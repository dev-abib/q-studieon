// src/common/helpers/ip.helper.ts
import type { Request } from 'express';

function cleanIp(ip: string): string {
  return ip.replace(/^::ffff:/, '').trim();
}

function isValidIp(ip: string): boolean {
  const cleaned = cleanIp(ip);
  return cleaned !== '' && cleaned !== 'unknown' && cleaned !== 'null' && cleaned !== 'undefined';
}

function isPrivateOrLocalIp(ip: string): boolean {
  const cleaned = cleanIp(ip);
  return (
    cleaned === '127.0.0.1' ||
    cleaned === '::1' ||
    cleaned === 'localhost' ||
    cleaned.startsWith('10.') ||
    cleaned.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleaned)
  );
}

export function getClientIp(req: Request | null | undefined): string {
  if (!req) return '127.0.0.1';

  // 1. Cloudflare
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (cfIp) {
    const raw = Array.isArray(cfIp) ? cfIp[0] : cfIp;
    if (raw && isValidIp(raw)) return cleanIp(raw);
  }

  // 2. True-Client-IP (Cloudflare Enterprise, Akamai, etc.)
  const trueClientIp = req.headers?.['true-client-ip'];
  if (trueClientIp) {
    const raw = Array.isArray(trueClientIp) ? trueClientIp[0] : trueClientIp;
    if (raw && isValidIp(raw)) return cleanIp(raw);
  }

  // 3. X-Real-IP (Nginx, Apache reverse proxy)
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) {
    const raw = Array.isArray(realIp) ? realIp[0] : realIp;
    if (raw && isValidIp(raw)) return cleanIp(raw);
  }

  // 4. X-Forwarded-For (inspect all forwarded proxies)
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ips = raw.split(',').map((s) => s.trim());
    // Find the first public / non-private IP
    for (const ip of ips) {
      if (ip && isValidIp(ip) && !isPrivateOrLocalIp(ip)) {
        return cleanIp(ip);
      }
    }
    // Fallback to first non-empty IP
    if (ips[0] && isValidIp(ips[0])) {
      return cleanIp(ips[0]);
    }
  }

  // 5. X-Client-IP
  const clientIp = req.headers?.['x-client-ip'];
  if (clientIp) {
    const raw = Array.isArray(clientIp) ? clientIp[0] : clientIp;
    if (raw && isValidIp(raw)) return cleanIp(raw);
  }

  // 6. Fastly / AWS CloudFront / Other CDN headers
  const fastlyIp = req.headers?.['fastly-client-ip'] || req.headers?.['x-cluster-client-ip'];
  if (fastlyIp) {
    const raw = Array.isArray(fastlyIp) ? fastlyIp[0] : fastlyIp;
    if (raw && isValidIp(raw)) return cleanIp(raw);
  }

  // 7. Express req.ip (from trust proxy)
  if (req.ip && isValidIp(req.ip)) {
    return cleanIp(req.ip);
  }

  // 8. Underlying socket remote address
  const socketIp = req.socket?.remoteAddress;
  if (socketIp && isValidIp(socketIp)) {
    return cleanIp(socketIp);
  }

  return '127.0.0.1';
}
