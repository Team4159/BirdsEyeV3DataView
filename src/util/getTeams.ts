import type { Firestore } from "firebase/firestore";
import { fetchScoutedEventsData } from "../firebase/fetchScoutedData.ts";

export async function getTeamsFromEvents(
  firestore: Firestore,
  events: string[],
) {
  const teamsMap = await fetchScoutedEventsData(firestore, events);

  return Array.from(teamsMap.values());
}
