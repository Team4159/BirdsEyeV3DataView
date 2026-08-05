import { fetchScoutedEventsData } from "../firebase/fetchScoutedData.ts";
import { Firestore } from "firebase/firestore";

export async function getTeamsFromEvents(
  firestore: Firestore,
  events: string[],
) {
  const teamsMap = await fetchScoutedEventsData(firestore, events);

  return Array.from(teamsMap.values());
}
