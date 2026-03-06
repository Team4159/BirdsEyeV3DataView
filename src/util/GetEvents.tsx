import type { FRCTeam } from "./FRCTeam";
import type { MatchData } from "./MatchData"

export function getEventsFromMatches(matches: MatchData[]): string[]{
    let events: string[] = [];
    console.log("getevnetsfrommatches runnign");
    matches.forEach((match) => {
        console.log(match.getKey().split("_")[0]);
    })
    return events;
}

export function getEventsFromTeams(teams: FRCTeam[]) : string[]{
    let events: string[] = [];
    teams.forEach((team) => {
        const matches = team.getMatches();
        matches.forEach((match) => {
            const eventName = match.getKey().split("_")[0];
            if(!events.includes(eventName)) events.push(eventName);
        })
    })
    return events;
}