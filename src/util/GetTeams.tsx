import { type Firestore } from "firebase/firestore";
import { FRCTeam } from "./FRCTeam";
import { fetchScoutedEventData, fetchScoutedMatchData, fetchScoutedTeamData } from "../firebase/FetchScoutedData";
import { MatchDataPoint, MatchDataPointFromFirestore } from "./MatchDataPoint";
import { MatchData } from "./MatchData";

export async function getTeamsFromEvents(firestore: Firestore, events: string[]) {
  const teamsMap = new Map<string, FRCTeam>();

  for (const event of events) {
    const data = await fetchScoutedEventData(firestore, event);

    for (const doc of data.docs) {
      const docData = doc.data();

      if (!teamsMap.has(docData.name)) {
        teamsMap.set(docData.name, new FRCTeam(docData.name));
      }

      const teamData = await fetchScoutedTeamData(firestore, event, docData.name);

      for (const matchDoc of teamData.docs) {
        const dataPoints: MatchDataPoint[] = [];
        const matchDocData = matchDoc.data();

        const datasetData = await fetchScoutedMatchData(
          firestore,
          event,
          docData.name,
          matchDocData.name
        );

        for (const datasetDoc of datasetData.docs) {
          const datasetDocData = datasetDoc.data();
          const dataPoint = MatchDataPointFromFirestore(datasetDocData);
          dataPoints.push(dataPoint);
        }

        teamsMap
          .get(docData.name)
          ?.addMatch(new MatchData(dataPoints, matchDocData.name));
      }
    }
  }

  return Array.from(teamsMap.values());
}