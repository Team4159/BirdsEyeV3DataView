export function compareMatchKeys(a: string, b: string): number {
  const typeOrder: Record<string, number> = {
    qm: 0,
    qf: 1,
    sf: 2,
    f: 3
  };

  function parseKey(key: string) {
    const matchPart = key.split("_")[1]; // qm12, qf1m2, etc.

    const type = matchPart.match(/^[a-z]+/)?.[0] ?? "";
    const matchNumber = Number(matchPart.split("m")[1] ?? 0);

    let setNumber = 0;
    if (type !== "qm") {
      setNumber = Number(matchPart.split("m")[0].replace(/[a-z]/g, ""));
    }

    return { type, matchNumber, setNumber };
  }

  const A = parseKey(a);
  const B = parseKey(b);

  // 1. compare match type
  if (typeOrder[A.type] !== typeOrder[B.type]) {
    return typeOrder[A.type] - typeOrder[B.type];
  }

  // 2. compare match number
  if (A.matchNumber !== B.matchNumber) {
    return A.matchNumber - B.matchNumber;
  }

  // 3. compare set number
  return A.setNumber - B.setNumber;
}

export function getMatchTypeFromKey(key: string): string {
  const matchPart = key.split("_")[1];

  if (matchPart.startsWith("qm")) return "Qualification";
  if (matchPart.startsWith("qf")) return "Quarterfinal";
  if (matchPart.startsWith("sf")) return "Semifinal";
  if (matchPart.startsWith("f")) return "Final";

  return "Unknown";
}

export function getMatchNumberFromKey(key: string): number {
  const matchPart = key.split("_")[1];

  const matchNumber = matchPart.split("m")[1];

  return Number(matchNumber);
}

export function getSetNumberFromKey(key: string): number | null {
  const matchPart = key.split("_")[1];

  if (matchPart.startsWith("qm")) return null;

  const setNumber = matchPart.split("m")[0].replace(/[a-z]/g, "");

  return Number(setNumber);
}

export function formatMatchLabel(key: string): string {
  const type = getMatchTypeFromKey(key);
  const matchNumber = getMatchNumberFromKey(key);
  const setNumber = getSetNumberFromKey(key);

  if (type === "Qualification") {
    return `QM ${matchNumber}`;
  }

  return `${type} ${setNumber} - Match ${matchNumber}`;
}