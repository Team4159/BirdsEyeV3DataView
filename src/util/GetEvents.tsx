import type { FRCTeam } from "./FRCTeam";

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