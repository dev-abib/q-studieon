// src/common/helpers/user-agent.helper.ts

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(userAgent?: string | null): ParsedUserAgent {
  if (!userAgent) {
    return { browser: 'Chrome / Web App', os: 'Desktop', device: 'Desktop' };
  }
  const ua = userAgent.toLowerCase();

  // OS
  let os = 'Desktop';
  if (ua.includes('windows nt 10.0')) os = 'Windows 10/11';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os') || ua.includes('mac_powerpc')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone')) os = 'iPhone (iOS)';
  else if (ua.includes('ipad')) os = 'iPad (iPadOS)';
  else if (ua.includes('cros')) os = 'ChromeOS';
  else if (ua.includes('linux')) os = 'Linux';

  // Browser
  let browser = 'Web Browser';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';

  // Device
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) device = 'Mobile';
  else if (ua.includes('ipad') || ua.includes('tablet')) device = 'Tablet';

  return { browser, os, device };
}
