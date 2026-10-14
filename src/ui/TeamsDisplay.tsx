import { useMemo, useState } from "react";
import type { FrcTeam } from "../util/FrcTeam";

export type DataRange = {
  min: number;
  max: number;
};
type DataRangeKey =
  | "avgScore"
  | "autoAvgScore"
  | "teleopAvgScore"
  | "climbAvgScore"
  | "dataPoints";

export function createDataRange(): DataRange {
  return {
    min: Number.MAX_SAFE_INTEGER,
    max: 0,
  };
}

export function updateDataRange(dataRange: DataRange, data: number) {
  if (data > dataRange.max) {
    dataRange.max = data;
  }
  if (data < dataRange.min) {
    dataRange.min = data;
  }
}

const interpolateColor = (
  startColor: [number, number, number],
  endColor: [number, number, number],
  ratio: number, // value between 0 and 1
): string => {
  const r = Math.trunc(ratio * endColor[0] + (1 - ratio) * startColor[0]);
  const g = Math.trunc(ratio * endColor[1] + (1 - ratio) * startColor[1]);
  const b = Math.trunc(ratio * endColor[2] + (1 - ratio) * startColor[2]);
  return `rgb(${r}, ${g}, ${b})`;
};

export function getColor(score: number, dataRange: DataRange) {
  const start: [number, number, number] = [255, 0, 0]; // Red
  const end: [number, number, number] = [0, 255, 0]; // Green
  const span = dataRange.max - dataRange.min || 1;
  const normalizedScore = (score - dataRange.min) / span;
  return interpolateColor(start, end, normalizedScore);
}

function calculateDataRanges(
  teams: FrcTeam[],
): Readonly<Record<DataRangeKey, DataRange>> {
  const dataRanges: Record<DataRangeKey, DataRange> = {
    avgScore: createDataRange(),
    autoAvgScore: createDataRange(),
    teleopAvgScore: createDataRange(),
    climbAvgScore: createDataRange(),
    dataPoints: createDataRange(),
  };
  teams.forEach((team) => {
    updateDataRange(dataRanges.avgScore, team.getAvgPoints());
    updateDataRange(dataRanges.autoAvgScore, team.getAvgAutoPoints());
    updateDataRange(dataRanges.teleopAvgScore, team.getAvgTeleopPoints());
    updateDataRange(dataRanges.climbAvgScore, team.getAvgClimbPoints());
    updateDataRange(dataRanges.dataPoints, team.getDataPoints());
  });
  return dataRanges;
}

type TeamSortComparator = (a: FrcTeam, b: FrcTeam) => number;

const TeamSortComparators: Record<string, TeamSortComparator> = {
  Points: (a, b) => b.getAvgPoints() - a.getAvgPoints()
} as const;

type TeamsDisplayProps = {
  teams: FrcTeam[];
  onTeamClick: (team: FrcTeam) => void;
};

export const TeamsDisplay = ({ teams, onTeamClick }: TeamsDisplayProps) => {
  const dataRanges = useMemo(() => calculateDataRanges(teams), [teams]);
  const [teamSortComparator, _] = useState<TeamSortComparator>(() => TeamSortComparators.Points);
  const sortedTeams = useMemo(() => teams.toSorted(teamSortComparator), [teams, teamSortComparator]);
  const sortedTeamsByPoints = useMemo(() => teams.toSorted(TeamSortComparators.Points), [teams]);
  return (
    <div className="teams-display">
      <div className="teams-display-row">
        <div className="teams-display-header">Rank</div>
        <div className="teams-display-header">Team</div>
        <div className="teams-display-header">Data</div>
        <div className="teams-display-header">Total</div>
        <div className="teams-display-header">Auto</div>
        <div className="teams-display-header">Teleop</div>
        <div className="teams-display-header">Climb</div>
      </div>
      {sortedTeams
        .map((team) => (
          <button
            key={team.getTeamName()}
            type="button"
            className="teams-display-row"
            onClick={() => onTeamClick(team)}
            style={{ cursor: "pointer" }}
          >
            <div className="teams-display-item">#{sortedTeamsByPoints.indexOf(team) + 1}</div>
            <div className="teams-display-item">
              {team.getTeamName().substring(3)}
            </div>
            <div
              style={{
                color: getColor(team.getDataPoints(), dataRanges.dataPoints),
              }}
              className="teams-display-item"
            >
              {team.getDataPoints()}
            </div>
            <div
              style={{
                color: getColor(team.getAvgPoints(), dataRanges.avgScore),
              }}
              className="teams-display-item"
            >
              {team.getAvgPoints().toFixed(2)}
            </div>
            <div
              style={{
                color: getColor(
                  team.getAvgAutoPoints(),
                  dataRanges.autoAvgScore,
                ),
              }}
              className="teams-display-item"
            >
              {team.getAvgAutoPoints().toFixed(2)}
            </div>
            <div
              style={{
                color: getColor(
                  team.getAvgTeleopPoints(),
                  dataRanges.teleopAvgScore,
                ),
              }}
              className="teams-display-item"
            >
              {team.getAvgTeleopPoints().toFixed(2)}
            </div>
            <div
              style={{
                color: getColor(
                  team.getAvgClimbPoints(),
                  dataRanges.climbAvgScore,
                ),
              }}
              className="teams-display-item"
            >
              {team.getAvgClimbPoints().toFixed(2)}
            </div>
          </button>
        ))}
    </div>
  );
};
