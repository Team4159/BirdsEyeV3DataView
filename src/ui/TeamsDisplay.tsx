import { useEffect } from "react";
import type { FrcTeam } from "../util/FrcTeam";

type DataRange = {
  min: number;
  max: number;
};
type DataRangeKey =
  | "avgScore"
  | "autoAvgScore"
  | "teleopAvgScore"
  | "climbAvgScore"
  | "dataPoints";
function createDataRange(): DataRange {
  const dataRange: DataRange = {
    min: 0,
    max: 0,
  };
  resetDataRange(dataRange);
  return dataRange;
}
function resetDataRange(dataRange: DataRange) {
  dataRange.min = Number.MAX_SAFE_INTEGER;
  dataRange.max = 0;
}
function updateDataRange(dataRange: DataRange, data: number) {
  if (data > dataRange.max) {
    dataRange.max = data;
  }
  if (data < dataRange.min) {
    dataRange.min = data;
  }
}
const dataRanges: Readonly<Record<DataRangeKey, DataRange>> = {
  avgScore: createDataRange(),
  autoAvgScore: createDataRange(),
  teleopAvgScore: createDataRange(),
  climbAvgScore: createDataRange(),
  dataPoints: createDataRange(),
};

type Props = {
  teams: FrcTeam[];
  events: string[];
  onTeamClick: (team: FrcTeam) => void;
};

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

function getColor(score: number, dataRange: DataRange) {
  const start: [number, number, number] = [255, 0, 0]; // Red
  const end: [number, number, number] = [0, 255, 0]; // Green
  const normalizedScore =
    (score - dataRange.min) / (dataRange.max - dataRange.min);
  return interpolateColor(start, end, normalizedScore);
}

function calculateHighestLowestScores(teams: FrcTeam[]) {
  teams.forEach((team) => {
    updateDataRange(dataRanges.avgScore, team.getAvgPoints());
    updateDataRange(dataRanges.autoAvgScore, team.getAvgAutoPoints());
    updateDataRange(dataRanges.teleopAvgScore, team.getAvgTeleopPoints());
    updateDataRange(dataRanges.climbAvgScore, team.getAvgClimbPoints());
    updateDataRange(dataRanges.dataPoints, team.getDataPoints());
  });
}

export const TeamsDisplay: React.FC<Props> = ({ teams, onTeamClick }) => {
  useEffect(() => {
    Object.values(dataRanges).forEach((dataRange) => resetDataRange(dataRange));
  }, []);
  calculateHighestLowestScores(teams);
  return (
    <div className="teams-display">
      <div className="teams-display-row">
        <div className="teams-display-header">Team</div>
        <div className="teams-display-header">Total</div>
        <div className="teams-display-header">Auto</div>
        <div className="teams-display-header">Teleop</div>
        <div className="teams-display-header">Climb</div>
        <div className="teams-display-header">Data Points</div>
      </div>
      {teams
        .sort((a, b) => b.getAvgPoints() - a.getAvgPoints())
        .map((team, index) => (
          <div
            key={index}
            className="teams-display-row"
            onClick={() => onTeamClick(team)}
            style={{ cursor: "pointer" }}
          >
            <div className="teams-display-item">{team.getTeamName().substring(3)}</div>
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
            <div
              style={{
                color: getColor(team.getDataPoints(), dataRanges.dataPoints),
              }}
              className="teams-display-item"
            >
              {team.getDataPoints()}
            </div>
          </div>
        ))}
    </div>
  );
};
