/**
 * Avatar Gradient Utilities
 * Shared functions for generating unique gradient avatars with initials
 */

/**
 * Convert HSL to RGB color
 */
export const hslToRgb = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Generate unique gradient colors from a string (user ID or email)
 * @param str - User identifier (ID or email)
 * @param isDark - Whether dark mode is active
 * @returns Array of two RGB color strings for gradient
 */
export const generateGradientFromString = (str: string, isDark: boolean): [string, string] => {
  // Hash the string to get consistent values
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate two colors from the hash
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 40) % 360; // Complementary color

  // For light mode: brighter, more saturated colors
  // For dark mode: slightly darker, more muted colors
  const saturation = isDark ? 65 : 75;
  const lightness1 = isDark ? 55 : 60;
  const lightness2 = isDark ? 45 : 50;

  const color1 = hslToRgb(hue1, saturation, lightness1);
  const color2 = hslToRgb(hue2, saturation, lightness2);

  return [color1, color2];
};

/**
 * Generate initials from first and last name
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @param fallback - Fallback string (e.g., email) if names are missing
 * @returns Initials (e.g., "CF" for "Chukwuma Francis")
 */
export const getInitials = (firstName: string, lastName: string, fallback: string = 'U'): string => {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (fallback) return fallback[0].toUpperCase();
  return '??';
};

import { createAvatar } from '@dicebear/core';
import { adventurer, lorelei } from '@dicebear/collection';

/**
 * Parse a DiceBear identifier into its style + seed components.
 */
const parseDiceBearIdentifier = (
  identifier: string,
  styleOverride: string,
): { style: string; seed: string } => {
  if (identifier.startsWith('dicebear://')) {
    const parts = identifier.replace('dicebear://', '').split('/');
    if (parts.length === 2) {
      return { style: parts[0], seed: parts[1] };
    }
  }
  return { style: styleOverride, seed: identifier };
};

/**
 * Generate a DiceBear avatar as a Data URI.
 *
 * On Android, expo-image fails silently when asked to render
 * base64-encoded SVG data URIs, so new code should prefer getAvatarSvg
 * plus react-native-svg's SvgXml. This helper is kept for legacy call
 * sites and for non-Image consumers (e.g. logging, web).
 */
export const getAvatarUrl = (identifier: string | null | undefined, styleOverride: string = 'adventurer'): string => {
  try {
    if (!identifier) return `https://api.dicebear.com/9.x/${styleOverride}/svg?seed=default`;

    if (identifier.startsWith('http')) return identifier;

    const { style, seed } = parseDiceBearIdentifier(identifier, styleOverride);

    const styleMap: Record<string, any> = { adventurer, lorelei };
    const chosenStyle = styleMap[style] || adventurer;
    return createAvatar(chosenStyle, { seed }).toDataUri();
  } catch (error) {
    console.error('Error generating local avatar:', error);
    return `https://api.dicebear.com/9.x/${styleOverride}/svg?seed=${encodeURIComponent(identifier as string)}`;
  }
};

/**
 * Generate a DiceBear avatar as a raw SVG XML string.
 * Use with react-native-svg's SvgXml — works on iOS + Android uniformly.
 * Returns null for legacy http(s) URLs (fall back to <Image>) or on failure.
 *
 * Cached per `style:seed` — DiceBear's generator + SVG serialization is
 * non-trivial and this is called from every BrigoAvatar render.
 */
const svgCache = new Map<string, string>();

export const getAvatarSvg = (
  identifier: string | null | undefined,
  styleOverride: string = 'adventurer',
): string | null => {
  try {
    if (identifier && identifier.startsWith('http')) return null;

    const { style, seed } = identifier
      ? parseDiceBearIdentifier(identifier, styleOverride)
      : { style: 'adventurer', seed: 'default' };

    const key = `${style}:${seed}`;
    const cached = svgCache.get(key);
    if (cached) return cached;

    const styleMap: Record<string, any> = { adventurer, lorelei };
    const chosenStyle = styleMap[style] || adventurer;
    const svg = createAvatar(chosenStyle, { seed }).toString();
    svgCache.set(key, svg);
    return svg;
  } catch (error) {
    console.error('Error generating local avatar SVG:', error);
    return null;
  }
};

/**
 * Curated seeds for the Lorelei style to ensure high-quality options
 */
export const CURATED_LORELEI_SEEDS = [
  'Felix', 'Aneka', 'Milo', 'Luna', 'Jasper',
  'Maya', 'Oliver', 'Sophie', 'Leo', 'Mia',
  'Charlie', 'Willow', 'Oscar', 'Ruby', 'Noah',
  'Ivy', 'Finn', 'Zoe', 'Arlo', 'Aria'
];

export const CURATED_ADVENTURER_SEEDS = [
  'Jack', 'Mia', 'Leo', 'Sophie', 'Alex',
  'Ruby', 'Oscar', 'Luna', 'Felix', 'Zoe',
  'Oliver', 'Chloe', 'Jasper', 'Daisy', 'Milo',
  'Belle', 'Arlo', 'Willow', 'Bear', 'Coco'
];

export const AVATAR_STYLES = [
  { id: 'adventurer', name: 'Adventurer' },
  { id: 'lorelei', name: 'Lorelei' }
];
