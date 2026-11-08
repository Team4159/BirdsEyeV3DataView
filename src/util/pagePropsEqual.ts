export function pagePropsEqual<T extends { isActive: boolean }>(
  previous: T,
  next: T,
): boolean {
  if (!previous.isActive && !next.isActive) {
    return true;
  }

  const keys = Object.keys(previous) as (keyof T)[];
  return (
    keys.length === Object.keys(next).length &&
    keys.every((key) => Object.is(previous[key], next[key]))
  );
}
