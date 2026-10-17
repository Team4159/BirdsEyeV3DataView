import type { Firestore } from "firebase/firestore";
import {
  fetchScoutedEvents,
  fetchScoutedEventsMatchDatas,
  fetchScoutedEventsTeamDatas,
} from "../firebase/fetchScoutedData.ts";

export async function fetchEvents(firestore: Firestore): Promise<string[]> {
  const events: string[] = [];
  const data = await fetchScoutedEvents(firestore);
  data.forEach((doc) => {
    const eventID = doc.id;
    events.push(eventID);
  });
  return events;
}

export async function fetchTeamsFromEvents(
  firestore: Firestore,
  events: string[],
) {
  const teamsMap = await fetchScoutedEventsTeamDatas(firestore, events);
  return Array.from(teamsMap.values());
}

export async function fetchMatchDatasFromEvents(
  firestore: Firestore,
  events: string[],
) {
  const matchDatas = await fetchScoutedEventsMatchDatas(
    firestore,
    events,
  );
  return matchDatas;
}
