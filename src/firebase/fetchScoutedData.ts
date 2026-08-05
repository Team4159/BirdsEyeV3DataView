import {
  collection,
  collectionGroup,
  documentId,
  Firestore,
  getDocs,
  query,
  QuerySnapshot,
  where,
} from "firebase/firestore";
import { FrcTeam } from "../util/FrcTeam";
import { MatchData } from "../util/matchData";
import { MatchDataPointFromFirestore } from "../util/matchDataPoint";

export async function fetchScoutedEvents(
  firestore: Firestore,
): Promise<QuerySnapshot> {
  const querySnapshot = await getDocs(collection(firestore, "events"));
  return querySnapshot;
}

export async function fetchScoutedEventsData(
  firestore: Firestore,
  events: string[],
): Promise<Map<string, FrcTeam>> {
  if (events.length == 0) {
    return new Map();
  }

  const promises = events.map((event) =>
    getDocs(
      query(
        collectionGroup(firestore, "datasets"),
        where(documentId(), ">", `events/${event}`),
        where(documentId(), "<", `events/${event}a`),
      ),
    ),
  );
  const querySnapshots = await Promise.all(promises);

  const dataMap = new Map<string, Map<string, MatchData>>();

  for (const querySnapshot of querySnapshots) {
    for (const doc of querySnapshot.docs) {
      const pathParts = doc.ref.path.split("/");
      const team = pathParts[3];
      const match = pathParts[5];
      if (!dataMap.get(team)) {
        dataMap.set(team, new Map());
      }
      if (!dataMap.get(team)?.get(match)) {
        dataMap.get(team)?.set(match, new MatchData([], match));
      }
      const dataPoint = MatchDataPointFromFirestore(doc.data());
      dataMap.get(team)?.get(match)?.addDataPoint(dataPoint);
    }
  }

  const teamsMap = new Map<string, FrcTeam>();
  dataMap.forEach((matchDataMap, team) => {
    const frcTeam = new FrcTeam(team);
    teamsMap.set(team, frcTeam);
    matchDataMap.forEach((matchData) => frcTeam.addMatch(matchData));
  });

  return teamsMap;
}

export async function fetchScoutedEventData(
  firestore: Firestore,
  event: string,
): Promise<QuerySnapshot> {
  const querySnapshot = await getDocs(
    collection(firestore, "events", event, "teams"),
  );
  return querySnapshot;
}

export async function fetchScoutedTeamData(
  firestore: Firestore,
  event: string,
  team: string,
): Promise<QuerySnapshot> {
  const querySnapshot = await getDocs(
    collection(firestore, "events", event, "teams", team, "matches"),
  );
  return querySnapshot;
}

export async function fetchScoutedMatchData(
  firestore: Firestore,
  event: string,
  team: string,
  match: string,
): Promise<QuerySnapshot> {
  const querySnapshot = await getDocs(
    collection(
      firestore,
      "events",
      event,
      "teams",
      team,
      "matches",
      match,
      "datasets",
    ),
  );
  return querySnapshot;
}
