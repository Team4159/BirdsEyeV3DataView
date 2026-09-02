import { TeamsDisplay } from "../ui/TeamsDisplay";
import type { FrcTeam } from "../util/FrcTeam";

type EventsOverviewPageProps = {
  eventsChosen: string[];
  teams: FrcTeam[];
};

export function EventsOverviewPage({
  eventsChosen,
  teams,
}: EventsOverviewPageProps) {
  return (
    <div>
      <div className="wide-card">
        <span className="text-container">{`Events (${eventsChosen.length}): ${eventsChosen.join(", ")}`}</span>
        <div className="xy-scroll-container">
          <TeamsDisplay
            teams={teams}
            events={eventsChosen}
            onTeamClick={console.log}
          />
        </div>
      </div>
    </div>
  );
}
