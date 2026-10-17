import {
  collection,
  collectionGroup,
  documentId,
  type Firestore,
  getDocs,
  type QuerySnapshot,
  query,
  where,
} from "firebase/firestore";
import { FrcTeam } from "../util/FrcTeam";
import { MatchData } from "../util/matchData";
import {
  matchDataPointFromFirestore,
} from "../util/matchDataPoint";

export async function fetchScoutedEvents(
  firestore: Firestore,
): Promise<QuerySnapshot> {
  const querySnapshot = await getDocs(collection(firestore, "events"));
  return querySnapshot;
}

export async function fetchScoutedEventsMatchDatas(
  firestore: Firestore,
  events: string[],
) {
  const promises = events.map((event) => getEventDocPromises(firestore, event));
  const querySnapshots = await Promise.all(promises);

  const matchDatas = new Map<string, MatchData>();
  for (const querySnapshot of querySnapshots) {
    for (const doc of querySnapshot.docs) {
      const pathParts = doc.ref.path.split("/");
      const match = pathParts[5];
      if (!matchDatas.has(match)) {
        matchDatas.set(match, new MatchData([], match));
      }
      const dataPoint = matchDataPointFromFirestore(doc.data());
      matchDatas.get(match)?.addDataPoint(dataPoint);
    }
  }

  return matchDatas;
}

export async function fetchScoutedEventsTeamDatas(
  firestore: Firestore,
  events: string[],
): Promise<Map<string, FrcTeam>> {
  if (events.length === 0) {
    return new Map();
  }

  const promises = events.map((event) => getEventDocPromises(firestore, event));
  const querySnapshots = await Promise.all(promises);

  const teamDatas = new Map<string, Map<string, MatchData>>();
  for (const querySnapshot of querySnapshots) {
    for (const doc of querySnapshot.docs) {
      const pathParts = doc.ref.path.split("/");
      const team = pathParts[3];
      const match = pathParts[5];
      if (!teamDatas.has(team)) {
        teamDatas.set(team, new Map());
      }
      if (!teamDatas.get(team)?.has(match)) {
        teamDatas.get(team)?.set(match, new MatchData([], match));
      }
      const dataPoint = matchDataPointFromFirestore(doc.data());
      teamDatas.get(team)?.get(match)?.addDataPoint(dataPoint);
    }
  }

  const teamsMap = new Map<string, FrcTeam>();
  teamDatas.forEach((matchDataMap, team) => {
    const frcTeam = new FrcTeam(team);
    teamsMap.set(team, frcTeam);
    matchDataMap.forEach((matchData) => {
      frcTeam.addMatch(matchData);
    });
  });

  return teamsMap;
}

export async function fetchScoutedEventTeamData(
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

async function getEventDocPromises(firestore: Firestore, event: string) {
  return getDocs(
    query(
      collectionGroup(firestore, "datasets"),
      where(documentId(), ">", `events/${event}`),
      where(documentId(), "<", `events/${event}\uf8ff`),
    ),
  );
}
