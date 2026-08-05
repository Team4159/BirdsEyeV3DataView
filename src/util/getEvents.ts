import { fetchScoutedEvents } from "../firebase/fetchScoutedData.ts";
import type { Firestore } from "firebase/firestore";

export async function getEvents(firestore: Firestore): Promise<string[]> {
  const events: string[] = [];
  const data = await fetchScoutedEvents(firestore);
  data.forEach((doc) => {
    const eventID = doc.id;
    events.push(eventID);
  });
  return events;
}
