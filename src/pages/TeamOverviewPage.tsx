import type { FrcTeam } from "../util/FrcTeam";

type TeamOverviewPageProps = {
  selectedTeam: FrcTeam | null
}

export function TeamOverviewPage({selectedTeam} :  TeamOverviewPageProps) {
  return <div className="wide-card">
    <h1>Team Overview</h1>
  </div>
}
