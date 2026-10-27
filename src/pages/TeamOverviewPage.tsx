import { MatchLineGraph } from "../ui/MatchLineGraph";
import type { FrcTeam } from "../util/FrcTeam";

type TeamOverviewPageProps = {
  selectedTeam: FrcTeam | null
}

export function TeamOverviewPage({ selectedTeam }: TeamOverviewPageProps) {
  return (
    <div className="wide-card">
      <h1>
        Team Overview
        {selectedTeam ? `: ${selectedTeam.getTeamName().substring(3)}` : ""}
      </h1>
      {selectedTeam ? (
        <MatchLineGraph team={selectedTeam} />
      ) : (
        <p>No team selected.</p>
      )}
    </div>
  );
}
