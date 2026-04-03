import { collection, Firestore, getDocs, QuerySnapshot} from "firebase/firestore";

export async function fetchScoutedData(firestore: Firestore) : Promise<QuerySnapshot>{
    const querySnapshot = await getDocs(collection(firestore, "events"));
    return querySnapshot;
}

export async function fetchScoutedEventData(firestore: Firestore, event: string) : Promise<QuerySnapshot>{
    const querySnapshot = await getDocs(collection(firestore, "events", event, "teams"));
    return querySnapshot;
}

export async function fetchScoutedTeamData(firestore: Firestore, event: string, team: string) : Promise<QuerySnapshot>{
    const querySnapshot = await getDocs(collection(firestore, "events", event, "teams", team, "matches"));
    return querySnapshot;
}

export async function fetchScoutedMatchData(firestore: Firestore, event: string, team: string, match : string) : Promise<QuerySnapshot>{
    const querySnapshot = await getDocs(collection(firestore, "events", event, "teams", team, "matches", match, "datasets"));
    return querySnapshot;
}