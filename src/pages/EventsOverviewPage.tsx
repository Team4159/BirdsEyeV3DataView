import { useMemo } from "react";
import { TeamsDisplay } from "../ui/TeamsDisplay";
import { eventsLabel } from "../util/eventsLabel";
import { FrcTeam } from "../util/FrcTeam";

type EventsOverviewPageProps = {
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
  teams: FrcTeam[];
};

export function EventsOverviewPage({
  eventChoices,
  aggregateEvents,
  displayEvents,
  teams,
}: EventsOverviewPageProps) {
  const headerMessage = useMemo(
    () => eventsLabel(eventChoices, aggregateEvents, displayEvents),
    [eventChoices, aggregateEvents, displayEvents],
  );

  const displayedTeams = useMemo(() => {
    return teams.flatMap((team) => {
      const matches = team
        .getMatches()
        .filter((match) => displayEvents.includes(match.getEvent()));
      if (matches.length === 0) return [];
      const filteredTeam = new FrcTeam(team.getTeamName());
      matches.forEach((match) => {
        filteredTeam.addMatch(match);
      });
      return [filteredTeam];
    });
  }, [teams, displayEvents]);

  return (
    <div>
      {displayEvents.length === 0 ? (
        <div className="card">
          <h1>Events Overview</h1>
          <span className="text-container">{headerMessage}</span>
        </div>
      ) : (
        <div className="wide-card">
          <h1>Events Overview</h1>
          <span className="text-container">{headerMessage}</span>
          <div className="xy-scroll-container">
            <TeamsDisplay teams={displayedTeams} onTeamClick={console.log} />
          </div>
        </div>
      )}
    </div>
  );
}
