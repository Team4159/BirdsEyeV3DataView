import { FrcTeam } from "./FrcTeam";

export function getDisplayTeamData(team: FrcTeam, aggregateEvents: string[], displayEvents: string[]) {
  let display = false;
  const matches = team.getMatches().filter((match) => {
    if (displayEvents.includes(match.getEvent())) {
      display = true;
    }
    return aggregateEvents.includes(match.getEvent());
  });
  if (!display || matches.length === 0) {
    return [];
  }
  const teamData = new FrcTeam(team.getTeamName());
  matches.forEach((match) => {
    teamData.addMatch(match);
  });
  return teamData;
}
