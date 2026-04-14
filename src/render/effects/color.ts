export function darkenHexColor(color: string, percent: number): string {
  const numeric = Number.parseInt(color.replace('#', ''), 16);
  const amount = Math.round(2.55 * percent);
  const red = Math.max(0, Math.min(255, (numeric >> 16) - amount));
  const green = Math.max(0, Math.min(255, ((numeric >> 8) & 0x00ff) - amount));
  const blue = Math.max(0, Math.min(255, (numeric & 0x0000ff) - amount));

  return `#${(0x1000000 + red * 0x10000 + green * 0x100 + blue).toString(16).slice(1)}`;
}
