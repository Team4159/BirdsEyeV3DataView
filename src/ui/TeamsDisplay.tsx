import { useMemo, useRef, useState } from "react";
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
  | "dataPoints"
  | "avgDriverRating"
  | "avgFouls"
  | "avgTechFouls";

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

export function getColor(
  score: number,
  dataRange: DataRange,
  inverted: boolean,
) {
  const start: [number, number, number] = [255, 0, 0]; // Red
  const end: [number, number, number] = [0, 255, 0]; // Green
  const span = dataRange.max - dataRange.min || 1;
  const normalizedScore = (score - dataRange.min) / span;
  if (!inverted) {
    return interpolateColor(start, end, normalizedScore);
  } else {
    return interpolateColor(end, start, normalizedScore);
  }
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
    avgDriverRating: createDataRange(),
    avgFouls: createDataRange(),
    avgTechFouls: createDataRange(),
  };
  teams.forEach((team) => {
    updateDataRange(dataRanges.avgScore, team.getAvgPoints());
    updateDataRange(dataRanges.autoAvgScore, team.getAvgAutoPoints());
    updateDataRange(dataRanges.teleopAvgScore, team.getAvgTeleopPoints());
    updateDataRange(dataRanges.climbAvgScore, team.getAvgClimbPoints());
    updateDataRange(dataRanges.dataPoints, team.getDataPoints());
    updateDataRange(dataRanges.avgDriverRating, team.getAvgDriverRating());
    updateDataRange(dataRanges.avgFouls, team.getAvgFouls());
    updateDataRange(dataRanges.avgTechFouls, team.getAvgTechFouls());
  });
  return dataRanges;
}

type TeamSortComparator = (a: FrcTeam, b: FrcTeam) => number;

const TeamSortComparators = {
  Rank: (a, b) => b.getAvgPoints() - a.getAvgPoints(),
  Total: (a, b) => b.getAvgPoints() - a.getAvgPoints(),
  Auto: (a, b) => b.getAvgAutoPoints() - a.getAvgAutoPoints(),
  Teleop: (a, b) => b.getAvgTeleopPoints() - a.getAvgTeleopPoints(),
  Climb: (a, b) => b.getAvgClimbPoints() - a.getAvgClimbPoints(),
  "Driver Rating": (a, b) => b.getAvgDriverRating() - a.getAvgDriverRating(),
  Fouls: (a, b) => a.getAvgFouls() - b.getAvgFouls(),
  "Major Fouls": (a, b) => a.getAvgTechFouls() - b.getAvgTechFouls(),
  Data: (a, b) => b.getDataPoints() - a.getDataPoints(),
  Team: (a, b) => a.getTeamName().localeCompare(b.getTeamName()),
} as const satisfies Record<string, TeamSortComparator>;

function getTeamSortComparator(
  key: keyof typeof TeamSortComparators,
  inverted: boolean,
): TeamSortComparator {
  const invert = inverted ? -1 : 1;
  return (a, b) => TeamSortComparators[key](a, b) * invert;
}

type TeamsDisplayProps = {
  teams: FrcTeam[];
  onTeamClick: (team: FrcTeam) => void;
};

export const TeamsDisplay = ({ teams, onTeamClick }: TeamsDisplayProps) => {
  const dataRanges = useMemo(() => calculateDataRanges(teams), [teams]);
  const teamSortComparatorKey =
    useRef<keyof typeof TeamSortComparators>("Rank");
  const teamSortComparatorInverted = useRef<boolean>(false);
  const [teamSortComparator, setTeamSortComparator] =
    useState<TeamSortComparator>(() =>
      getTeamSortComparator(
        teamSortComparatorKey.current,
        teamSortComparatorInverted.current,
      ),
    );
  const sortedTeams = useMemo(
    () => teams.toSorted(teamSortComparator),
    [teams, teamSortComparator],
  );
  const sortedTeamsByPoints = useMemo(
    () => teams.toSorted(TeamSortComparators.Rank),
    [teams],
  );

  const handleSort = (key: keyof typeof TeamSortComparators) => {
    if (TeamSortComparators[key]) {
      if (teamSortComparatorKey.current !== key) {
        teamSortComparatorKey.current = key;
        teamSortComparatorInverted.current = false;
      } else {
        teamSortComparatorInverted.current =
          !teamSortComparatorInverted.current;
      }
      setTeamSortComparator(() =>
        getTeamSortComparator(key, teamSortComparatorInverted.current),
      );
    }
  };

  function header(name: keyof typeof TeamSortComparators) {
    return (
      <div className="teams-display-header">
        <button
          type="button"
          className="teams-display-sort-button"
          onClick={() => handleSort(name)}
          style={{
            borderTop: "2px solid",
            borderBottom: "2px solid",
            borderTopColor:
              teamSortComparatorKey.current === name &&
              !teamSortComparatorInverted.current
                ? "white"
                : "transparent",
            borderBottomColor:
              teamSortComparatorKey.current === name &&
              teamSortComparatorInverted.current
                ? "white"
                : "transparent",
          }}
        >
          {name}
        </button>
      </div>
    );
  }

  return (
    <div className="teams-display">
      <div
        className="teams-display-row"
        style={{
          paddingBottom: "4px",
        }}
      >
        {header("Rank")}
        {header("Team")}
        {header("Data")}
        {header("Total")}
        {header("Auto")}
        {header("Teleop")}
        {header("Climb")}
        {header("Driver Rating")}
        {header("Fouls")}
        {header("Major Fouls")}
      </div>
      {sortedTeams.map((team) => (
        <button
          key={team.getTeamName()}
          type="button"
          className="teams-display-row"
          onClick={() => onTeamClick(team)}
          style={{ cursor: "pointer" }}
        >
          <div className="teams-display-item">
            #{sortedTeamsByPoints.indexOf(team) + 1}
          </div>
          <div className="teams-display-item">
            {team.getTeamName().substring(3)}
          </div>
          <div
            style={{
              color: getColor(
                team.getDataPoints(),
                dataRanges.dataPoints,
                false,
              ),
            }}
            className="teams-display-item"
          >
            {team.getDataPoints()}
          </div>
          <div
            style={{
              color: getColor(team.getAvgPoints(), dataRanges.avgScore, false),
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
                false,
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
                false,
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
                false,
              ),
            }}
            className="teams-display-item"
          >
            {team.getAvgClimbPoints().toFixed(2)}
          </div>
          <div
            style={{
              color: getColor(
                team.getAvgDriverRating(),
                dataRanges.avgDriverRating,
                false,
              ),
            }}
            className="teams-display-item"
          >
            {team.getAvgDriverRating().toFixed(2)}
          </div>
          <div
            style={{
              color: getColor(team.getAvgFouls(), dataRanges.avgFouls, true),
            }}
            className="teams-display-item"
          >
            {team.getAvgFouls().toFixed(2)}
          </div>
          <div
            style={{
              color: getColor(
                team.getAvgTechFouls(),
                dataRanges.avgTechFouls,
                true,
              ),
            }}
            className="teams-display-item"
          >
            {team.getAvgTechFouls().toFixed(2)}
          </div>
        </button>
      ))}
    </div>
  );
};
