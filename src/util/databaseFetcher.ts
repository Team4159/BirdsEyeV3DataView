import type { Firestore } from "firebase/firestore";
import { fetchScoutedEvents, fetchScoutedEventsData } from "../firebase/fetchScoutedData.ts";

export async function getEvents(firestore: Firestore): Promise<string[]> {
  const events: string[] = [];
  const data = await fetchScoutedEvents(firestore);
  data.forEach((doc) => {
    const eventID = doc.id;
    events.push(eventID);
  });
  return events;
}

export async function getTeamsFromEvents(
  firestore: Firestore,
  events: string[],
) {
  const teamsMap = await fetchScoutedEventsData(firestore, events);

  return Array.from(teamsMap.values());
}
