/**
 * OKLCH Color Utilities
 * 
 * Comprehensive utility functions for working with OKLCH color space.
 * OKLCH provides better perceptual uniformity and more predictable color manipulation
 * compared to HSL/RGB color spaces.
 * 
 * OKLCH Components:
 * - L (Lightness): 0-1 (0 = black, 1 = white)
 * - C (Chroma): 0+ (0 = grayscale, higher = more saturated)
 * - H (Hue): 0-360 degrees (same as HSL hue)
 * 
 * Reference: https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
 */

export interface OKLCHColor {
  l: number; // Lightness: 0-1
  c: number; // Chroma: 0+ (typically 0-0.4)
  h: number; // Hue: 0-360 degrees
  alpha?: number; // Alpha: 0-1 (optional)
}

export interface RGBColor {
  r: number; // Red: 0-255
  g: number; // Green: 0-255
  b: number; // Blue: 0-255
  alpha?: number; // Alpha: 0-1 (optional)
}

export interface HSLColor {
  h: number; // Hue: 0-360
  s: number; // Saturation: 0-100
  l: number; // Lightness: 0-100
  alpha?: number; // Alpha: 0-1 (optional)
}

/**
 * Convert HEX color to RGB
 */
export function hexToRgb(hex: string): RGBColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB to HEX
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Convert RGB to linear RGB (gamma correction)
 */
function rgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 
    ? normalized / 12.92 
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear RGB to RGB (inverse gamma correction)
 */
function linearToRgb(value: number): number {
  const linear = value <= 0.0031308 
    ? value * 12.92 
    : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  return Math.round(linear * 255);
}

/**
 * Convert RGB to XYZ color space (D65 illuminant)
 */
function rgbToXyz(rgb: RGBColor): { x: number; y: number; z: number } {
  const r = rgbToLinear(rgb.r);
  const g = rgbToLinear(rgb.g);
  const b = rgbToLinear(rgb.b);

  // sRGB to XYZ matrix (D65)
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

  return { x, y, z };
}

/**
 * Convert XYZ to RGB color space
 */
function xyzToRgb(xyz: { x: number; y: number; z: number }): RGBColor {
  // XYZ to sRGB matrix (D65)
  const r = xyz.x * 3.2404542 + xyz.y * -1.5371385 + xyz.z * -0.4985314;
  const g = xyz.x * -0.9692660 + xyz.y * 1.8760108 + xyz.z * 0.0415560;
  const b = xyz.x * 0.0556434 + xyz.y * -0.2040259 + xyz.z * 1.0572252;

  return {
    r: Math.max(0, Math.min(255, linearToRgb(r))),
    g: Math.max(0, Math.min(255, linearToRgb(g))),
    b: Math.max(0, Math.min(255, linearToRgb(b)))
  };
}

/**
 * Convert XYZ to LAB color space
 */
function xyzToLab(xyz: { x: number; y: number; z: number }): { l: number; a: number; b: number } {
  // D65 white point
  const xn = 0.95047;
  const yn = 1.00000;
  const zn = 1.08883;

  const fx = labF(xyz.x / xn);
  const fy = labF(xyz.y / yn);
  const fz = labF(xyz.z / zn);

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return { l, a, b };
}

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.pow(t, 1 / 3) : t / (3 * delta ** 2) + 4 / 29;
}

/**
 * Convert LAB to XYZ color space
 */
function labToXyz(lab: { l: number; a: number; b: number }): { x: number; y: number; z: number } {
  // D65 white point
  const xn = 0.95047;
  const yn = 1.00000;
  const zn = 1.08883;

  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  const x = xn * labFInverse(fx);
  const y = yn * labFInverse(fy);
  const z = zn * labFInverse(fz);

  return { x, y, z };
}

function labFInverse(t: number): number {
  const delta = 6 / 29;
  return t > delta ? t ** 3 : 3 * delta ** 2 * (t - 4 / 29);
}

/**
 * Convert LAB to OKLCH color space using proper OKLab conversion
 */
function labToOklch(lab: { l: number; a: number; b: number }): OKLCHColor {
  // First convert LAB to XYZ
  const xyz = labToXyz(lab);

  // Convert XYZ to linear RGB
  const rgb = xyzToRgb(xyz);
  const r = rgbToLinear(rgb.r);
  const g = rgbToLinear(rgb.g);
  const b = rgbToLinear(rgb.b);

  // Convert linear RGB to OKLab using proper matrix transformation
  const l_oklab = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_oklab = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_oklab = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_cube = Math.cbrt(l_oklab);
  const m_cube = Math.cbrt(m_oklab);
  const s_cube = Math.cbrt(s_oklab);

  const L = 0.2104542553 * l_cube + 0.7936177850 * m_cube - 0.0040720468 * s_cube;
  const a = 1.9779984951 * l_cube - 2.4285922050 * m_cube + 0.4505937099 * s_cube;
  const b_oklab = 0.0259040371 * l_cube + 0.7827717662 * m_cube - 0.8086757660 * s_cube;

  // Convert to OKLCH
  const c = Math.sqrt(a * a + b_oklab * b_oklab);

  // When chroma is very low, hue becomes undefined/unstable
  // Set to 0 to avoid random hue values
  let h = 0;
  if (c > 0.001) {
    h = Math.atan2(b_oklab, a) * 180 / Math.PI;
    if (h < 0) h += 360;
  }

  return {
    l: Math.max(0, Math.min(1, L)),
    c: Math.max(0, c),
    h: h
  };
}

/**
 * Convert OKLCH to LAB color space using proper OKLab conversion
 */
function oklchToLab(oklch: OKLCHColor): { l: number; a: number; b: number } {
  // Convert OKLCH to OKLab
  const L = oklch.l;
  const hRad = oklch.h * Math.PI / 180;

  // When chroma is very low, set a and b to exactly 0 to avoid numerical errors
  const a = oklch.c < 0.001 ? 0 : oklch.c * Math.cos(hRad);
  const b = oklch.c < 0.001 ? 0 : oklch.c * Math.sin(hRad);

  // Convert OKLab to linear RGB using inverse matrix
  const l_cube = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_cube = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_cube = L - 0.0894841775 * a - 1.2914855480 * b;

  const l_linear = l_cube * l_cube * l_cube;
  const m_linear = m_cube * m_cube * m_cube;
  const s_linear = s_cube * s_cube * s_cube;

  const r = +4.0767416621 * l_linear - 3.3077115913 * m_linear + 0.2309699292 * s_linear;
  const g = -1.2684380046 * l_linear + 2.6097574011 * m_linear - 0.3413193965 * s_linear;
  const b_linear = -0.0041960863 * l_linear - 0.7034186147 * m_linear + 1.7076147010 * s_linear;

  // Convert linear RGB to XYZ then to LAB
  const rgb = {
    r: linearToRgb(r),
    g: linearToRgb(g),
    b: linearToRgb(b_linear)
  };

  const xyz = rgbToXyz(rgb);
  return xyzToLab(xyz);
}

/**
 * Convert RGB to OKLCH
 */
export function rgbToOklch(rgb: RGBColor): OKLCHColor {
  const xyz = rgbToXyz(rgb);
  const lab = xyzToLab(xyz);
  const oklch = labToOklch(lab);
  
  return {
    ...oklch,
    alpha: rgb.alpha
  };
}

/**
 * Convert OKLCH to RGB
 */
export function oklchToRgb(oklch: OKLCHColor): RGBColor {
  const lab = oklchToLab(oklch);
  const xyz = labToXyz(lab);
  const rgb = xyzToRgb(xyz);
  
  return {
    ...rgb,
    alpha: oklch.alpha
  };
}

/**
 * Convert HEX to OKLCH
 */
export function hexToOklch(hex: string): OKLCHColor | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToOklch(rgb) : null;
}

/**
 * Convert OKLCH to HEX
 */
export function oklchToHex(oklch: OKLCHColor): string {
  // Validate input values
  const validatedOklch = {
    l: Math.max(0, Math.min(1, oklch.l)),
    c: Math.max(0, oklch.c),
    h: isNaN(oklch.h) ? 0 : oklch.h % 360
  };

  // Handle edge cases for pure white and black
  if (validatedOklch.l >= 0.98 && validatedOklch.c <= 0.02) {
    return '#ffffff'; // Pure white
  }
  if (validatedOklch.l <= 0.02 && validatedOklch.c <= 0.02) {
    return '#000000'; // Pure black
  }

  const rgb = oklchToRgb(validatedOklch);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Convert HSL to OKLCH
 */
export function hslToOklch(hsl: HSLColor): OKLCHColor {
  // Convert HSL to RGB first
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 1/6) {
    r = c; g = x; b = 0;
  } else if (1/6 <= h && h < 2/6) {
    r = x; g = c; b = 0;
  } else if (2/6 <= h && h < 3/6) {
    r = 0; g = c; b = x;
  } else if (3/6 <= h && h < 4/6) {
    r = 0; g = x; b = c;
  } else if (4/6 <= h && h < 5/6) {
    r = x; g = 0; b = c;
  } else if (5/6 <= h && h < 1) {
    r = c; g = 0; b = x;
  }

  const rgb: RGBColor = {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    alpha: hsl.alpha
  };

  return rgbToOklch(rgb);
}

/**
 * Format OKLCH color for CSS
 */
export function formatOklchForCSS(oklch: OKLCHColor): string {
  const l = (oklch.l * 100).toFixed(2);
  const c = oklch.c.toFixed(4);
  const h = oklch.h.toFixed(1);
  
  if (oklch.alpha !== undefined && oklch.alpha < 1) {
    return `oklch(${l}% ${c} ${h} / ${oklch.alpha})`;
  }
  
  return `oklch(${l}% ${c} ${h})`;
}

/**
 * Format OKLCH for CSS custom properties (space-separated values)
 */
export function formatOklchForCSSVar(oklch: OKLCHColor): string {
  // Validate and clamp values
  const l = Math.max(0, Math.min(100, oklch.l * 100)).toFixed(2);
  const c = Math.max(0, oklch.c).toFixed(4);
  const h = (isNaN(oklch.h) ? 0 : oklch.h % 360).toFixed(1);

  return `${l}% ${c} ${h}`;
}

/**
 * Parse OKLCH string to OKLCHColor object
 */
export function parseOklch(oklchString: string): OKLCHColor | null {
  const match = oklchString.match(/oklch\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\s*\)/);

  if (!match) return null;

  return {
    l: parseFloat(match[1]) / 100,
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
    alpha: match[4] ? parseFloat(match[4]) : undefined
  };
}

/**
 * OKLCH Color Manipulation Functions
 */

/**
 * Adjust lightness of an OKLCH color
 */
export function adjustLightness(oklch: OKLCHColor, amount: number): OKLCHColor {
  return {
    ...oklch,
    l: Math.max(0, Math.min(1, oklch.l + amount))
  };
}

/**
 * Adjust chroma (saturation) of an OKLCH color
 */
export function adjustChroma(oklch: OKLCHColor, amount: number): OKLCHColor {
  return {
    ...oklch,
    c: Math.max(0, oklch.c + amount)
  };
}

/**
 * Adjust hue of an OKLCH color
 */
export function adjustHue(oklch: OKLCHColor, degrees: number): OKLCHColor {
  let newHue = oklch.h + degrees;
  while (newHue < 0) newHue += 360;
  while (newHue >= 360) newHue -= 360;

  return {
    ...oklch,
    h: newHue
  };
}

/**
 * Create a lighter version of an OKLCH color
 */
export function lighten(oklch: OKLCHColor, amount: number = 0.1): OKLCHColor {
  return adjustLightness(oklch, amount);
}

/**
 * Create a darker version of an OKLCH color
 */
export function darken(oklch: OKLCHColor, amount: number = 0.1): OKLCHColor {
  return adjustLightness(oklch, -amount);
}

/**
 * Create a more saturated version of an OKLCH color
 */
export function saturate(oklch: OKLCHColor, amount: number = 0.05): OKLCHColor {
  return adjustChroma(oklch, amount);
}

/**
 * Create a less saturated version of an OKLCH color
 */
export function desaturate(oklch: OKLCHColor, amount: number = 0.05): OKLCHColor {
  return adjustChroma(oklch, -amount);
}

/**
 * Generate a complementary color (180° hue shift)
 */
export function complement(oklch: OKLCHColor): OKLCHColor {
  return adjustHue(oklch, 180);
}

/**
 * Generate triadic colors (120° hue shifts)
 */
export function triadic(oklch: OKLCHColor): [OKLCHColor, OKLCHColor] {
  return [
    adjustHue(oklch, 120),
    adjustHue(oklch, 240)
  ];
}

/**
 * Generate analogous colors (30° hue shifts)
 */
export function analogous(oklch: OKLCHColor): [OKLCHColor, OKLCHColor] {
  return [
    adjustHue(oklch, -30),
    adjustHue(oklch, 30)
  ];
}

/**
 * Calculate contrast ratio between two OKLCH colors
 * Uses WCAG 2.1 contrast calculation based on relative luminance
 */
export function contrastRatio(color1: OKLCHColor, color2: OKLCHColor): number {
  // Convert to RGB to calculate relative luminance
  const rgb1 = oklchToRgb(color1);
  const rgb2 = oklchToRgb(color2);

  const lum1 = relativeLuminance(rgb1);
  const lum2 = relativeLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate relative luminance for contrast calculations
 */
function relativeLuminance(rgb: RGBColor): number {
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Check if a color meets WCAG AA contrast requirements (4.5:1)
 */
export function meetsContrastAA(foreground: OKLCHColor, background: OKLCHColor): boolean {
  return contrastRatio(foreground, background) >= 4.5;
}

/**
 * Check if a color meets WCAG AAA contrast requirements (7:1)
 */
export function meetsContrastAAA(foreground: OKLCHColor, background: OKLCHColor): boolean {
  return contrastRatio(foreground, background) >= 7;
}

/**
 * Utility function to ensure a color has sufficient contrast against a background
 * Automatically adjusts lightness to meet minimum contrast ratio
 */
export function ensureContrast(
  foreground: OKLCHColor,
  background: OKLCHColor,
  minRatio: number = 4.5
): OKLCHColor {
  let adjusted = { ...foreground };
  let currentRatio = contrastRatio(adjusted, background);

  if (currentRatio >= minRatio) {
    return adjusted;
  }

  // Try making it lighter first
  const lighterVersion = { ...adjusted, l: Math.min(1, adjusted.l + 0.1) };
  const lighterRatio = contrastRatio(lighterVersion, background);

  // Try making it darker
  const darkerVersion = { ...adjusted, l: Math.max(0, adjusted.l - 0.1) };
  const darkerRatio = contrastRatio(darkerVersion, background);

  // Choose the direction that gives better contrast
  if (lighterRatio > darkerRatio && lighterRatio > currentRatio) {
    // Go lighter
    while (currentRatio < minRatio && adjusted.l < 1) {
      adjusted.l = Math.min(1, adjusted.l + 0.05);
      currentRatio = contrastRatio(adjusted, background);
    }
  } else if (darkerRatio > currentRatio) {
    // Go darker
    while (currentRatio < minRatio && adjusted.l > 0) {
      adjusted.l = Math.max(0, adjusted.l - 0.05);
      currentRatio = contrastRatio(adjusted, background);
    }
  }

  return adjusted;
}
