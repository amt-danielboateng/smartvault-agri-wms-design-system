/**
 * Transforms a hex or rgb(a) color value into bare HSL channels: "H S% L%"
 * so Tailwind can wrap it as hsl(var(--token)) with optional alpha.
 */
function hexToHsl(hex) {
  const clean = hex.replace("#", "");
  const len = clean.length === 3 ? 1 : 2;
  let [r, g, b] = [0, 2, 4].map((i) =>
    parseInt(clean.slice(i, i + len).padEnd(2, clean[i]), 16) / 255
  );

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / delta + 2) / 6; break;
      case b: h = ((r - g) / delta + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

module.exports = {
  name: "color/hsl-channels",
  type: "value",
  matcher: (token) => token.attributes?.category === "color",
  transformer: (token) => {
    const val = token.original.value;
    if (typeof val === "string" && val.startsWith("#")) return hexToHsl(val);
    // Pass through already-transformed references
    return val;
  },
};
