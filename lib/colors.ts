const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

type Rgb = {
  r: number;
  g: number;
  b: number;
};

export function isHexColor(value: string | undefined): value is string {
  return Boolean(value && HEX_COLOR.test(value.trim()));
}

export function normalizeHexColor(
  value: string | undefined,
  fallback = "#2563eb",
) {
  if (!isHexColor(value)) {
    return fallback;
  }

  const hex = value.trim();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }

  return hex.toLowerCase();
}

export function hexToRgb(hexValue: string): Rgb {
  const hex = normalizeHexColor(hexValue).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function componentToHex(component: number) {
  return Math.round(Math.min(255, Math.max(0, component)))
    .toString(16)
    .padStart(2, "0");
}

export function rgbToHex({ r, g, b }: Rgb) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

export function mixColors(color: string, target: string, weight: number) {
  const safeWeight = Math.min(1, Math.max(0, weight));
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);

  return rgbToHex({
    r: sourceRgb.r * (1 - safeWeight) + targetRgb.r * safeWeight,
    g: sourceRgb.g * (1 - safeWeight) + targetRgb.g * safeWeight,
    b: sourceRgb.b * (1 - safeWeight) + targetRgb.b * safeWeight,
  });
}

export function getReadableTextColor(background: string) {
  const { r, g, b } = hexToRgb(background);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#111827" : "#ffffff";
}

export function getSoftBackground(color: string) {
  return mixColors(color, "#ffffff", 0.88);
}

export function getDeepBackground(color: string) {
  return mixColors(color, "#111827", 0.62);
}

export function getMutedAccent(color: string) {
  return mixColors(color, "#64748b", 0.32);
}
