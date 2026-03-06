import type { Firestore } from "firebase/firestore";
import { FRCTeam } from "./FRCTeam";
import { fetchScoutedData } from "../firebase/FetchScoutedData";
import { MatchDataFromFirestore } from "./MatchData";

export async function getTeams(firestore: Firestore): Promise<FRCTeam[]>{
    let teamsMap = new Map<string, FRCTeam>();
    const data = await fetchScoutedData(firestore);
    data.forEach((doc) => {
        const docData = doc.data()
        if(teamsMap.get(docData.team)){
        }
        else{
            teamsMap.set(docData.team, new FRCTeam(docData.team));
        }
        teamsMap.get(docData.team)?.addMatch(
            MatchDataFromFirestore(docData)
        )
    })
    return Array.from(teamsMap.values());
}