import { fetchScoutedData } from "../firebase/FetchScoutedData";
import type { Firestore } from "firebase/firestore";

export async function getEvents(firestore : Firestore) : Promise<string[]>{
    let events:string[] = [];
    const data = await fetchScoutedData(firestore);
    data.forEach((doc) => {
        const eventID = doc.id;
        events.push(eventID);
    })
    return events;
}