import type { DataRange } from "./DataRange";

const interpolateColor = (
  startColor: [number, number, number],
  endColor: [number, number, number],
  ratio: number, // value between 0 and 1
): string => {
  const r = Math.trunc(ratio * endColor[0] + (1 - ratio) * startColor[0]);
  const g = Math.trunc(ratio * endColor[1] + (1 - ratio) * startColor[1]);
  const b = Math.trunc(ratio * endColor[2] + (1 - ratio) * startColor[2]);
  return `rgb(${r}, ${g}, ${b})`;
};

export function getStatColor(
  score: number,
  dataRange: DataRange,
  inverted: boolean,
) {
  const start: [number, number, number] = [255, 0, 0]; // Red
  const end: [number, number, number] = [0, 255, 0]; // Green
  const span = dataRange.max - dataRange.min || 1;
  const normalizedScore = (score - dataRange.min) / span;
  if (!inverted) {
    return interpolateColor(start, end, normalizedScore);
  } else {
    return interpolateColor(end, start, normalizedScore);
  }
}
