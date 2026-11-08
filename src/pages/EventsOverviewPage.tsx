import { memo, useMemo, useState } from "react";
import { FetchingDataText } from "../ui/FetchingDataText";
import {
  createDataRange,
  type DataRange,
  extendDataRange,
} from "../util/DataRange";
import { eventsLabel } from "../util/eventsLabel";
import type { FrcTeam } from "../util/FrcTeam";
import { getStatColor } from "../util/getStatColor";
import { pagePropsEqual } from "../util/pagePropsEqual";
import { getDisplayTeamData } from "../util/teamData";

type DataRangeKey =
  | "avgScore"
  | "autoAvgScore"
  | "teleopAvgScore"
  | "climbAvgScore"
  | "dataPoints"
  | "avgDriverRating"
  | "avgFouls"
  | "avgTechFouls";

type TeamSortKey =
  | "Rank"
  | "Team"
  | "Data"
  | "Total"
  | "Auto"
  | "Teleop"
  | "Climb"
  | "Driver Rating"
  | "Fouls"
  | "Major Fouls";

type TeamStatistics = {
  team: FrcTeam;
  teamName: string;
  avgScore: number;
  autoAvgScore: number;
  teleopAvgScore: number;
  climbAvgScore: number;
  dataPoints: number;
  avgDriverRating: number;
  avgFouls: number;
  avgTechFouls: number;
};

function calculateDataRanges(
  teams: TeamStatistics[],
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
    extendDataRange(dataRanges.avgScore, team.avgScore);
    extendDataRange(dataRanges.autoAvgScore, team.autoAvgScore);
    extendDataRange(dataRanges.teleopAvgScore, team.teleopAvgScore);
    extendDataRange(dataRanges.climbAvgScore, team.climbAvgScore);
    extendDataRange(dataRanges.dataPoints, team.dataPoints);
    extendDataRange(dataRanges.avgDriverRating, team.avgDriverRating);
    extendDataRange(dataRanges.avgFouls, team.avgFouls);
    extendDataRange(dataRanges.avgTechFouls, team.avgTechFouls);
  });
  return dataRanges;
}

function compareTeamStatistics(
  a: TeamStatistics,
  b: TeamStatistics,
  key: TeamSortKey,
): number {
  let comparison = 0;
  switch (key) {
    case "Rank":
    case "Total":
      comparison = b.avgScore - a.avgScore;
      break;
    case "Auto":
      comparison = b.autoAvgScore - a.autoAvgScore;
      break;
    case "Teleop":
      comparison = b.teleopAvgScore - a.teleopAvgScore;
      break;
    case "Climb":
      comparison = b.climbAvgScore - a.climbAvgScore;
      break;
    case "Driver Rating":
      comparison = b.avgDriverRating - a.avgDriverRating;
      break;
    case "Fouls":
      comparison = a.avgFouls - b.avgFouls;
      break;
    case "Major Fouls":
      comparison = a.avgTechFouls - b.avgTechFouls;
      break;
    case "Data":
      comparison = b.dataPoints - a.dataPoints;
      break;
    case "Team":
      return (
        parseInt(b.teamName.substring(3), 10) -
          parseInt(a.teamName.substring(3), 10) ||
        b.teamName.localeCompare(a.teamName)
      );
  }

  return (
    comparison ||
    b.avgScore - a.avgScore ||
    b.teamName.localeCompare(a.teamName)
  );
}

type EventsOverviewPageProps = {
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
  teams: FrcTeam[];
  onTeamClick: (team: FrcTeam) => void;
  isActive: boolean;
  isTeamsDataUpdated: boolean;
};

export const EventsOverviewPage = memo(function EventsOverviewPage({
  eventChoices,
  aggregateEvents,
  displayEvents,
  teams,
  onTeamClick,
  isTeamsDataUpdated,
}: EventsOverviewPageProps) {
  const headerMessage = useMemo(
    () => eventsLabel(eventChoices, aggregateEvents, displayEvents),
    [eventChoices, aggregateEvents, displayEvents],
  );

  const displayedTeams = useMemo(() => {
    return teams.flatMap((team) => {
      return getDisplayTeamData(team, aggregateEvents, displayEvents);
    });
  }, [teams, aggregateEvents, displayEvents]);

  const teamStatistics = useMemo<TeamStatistics[]>(
    () =>
      displayedTeams.map((team) => ({
        team,
        teamName: team.getTeamName(),
        avgScore: team.getAvgPointsNoFouls(),
        autoAvgScore: team.getAvgAutoPoints(),
        teleopAvgScore: team.getAvgTeleopPoints(),
        climbAvgScore: team.getAvgClimbPoints(),
        dataPoints: team.getDataPoints(),
        avgDriverRating: team.getAvgDriverRating(),
        avgFouls: team.getAvgFouls(),
        avgTechFouls: team.getAvgTechFouls(),
      })),
    [displayedTeams],
  );
  const dataRanges = useMemo(
    () => calculateDataRanges(teamStatistics),
    [teamStatistics],
  );
  const [teamSortKey, setTeamSortKey] = useState<TeamSortKey>("Rank");
  const [teamSortInverted, setTeamSortInverted] = useState(false);
  const sortedTeams = useMemo(
    () =>
      teamStatistics.toSorted((a, b) => {
        const comparison = compareTeamStatistics(a, b, teamSortKey);
        return teamSortInverted ? -comparison : comparison;
      }),
    [teamStatistics, teamSortKey, teamSortInverted],
  );
  const rankByTeamName = useMemo(
    () =>
      new Map(
        teamStatistics
          .toSorted((a, b) => compareTeamStatistics(a, b, "Rank"))
          .map((team, index): [string, number] => [team.teamName, index + 1]),
      ),
    [teamStatistics],
  );

  const handleSort = (key: TeamSortKey) => {
    if (teamSortKey === key) {
      setTeamSortInverted((inverted) => !inverted);
    } else {
      setTeamSortKey(key);
      setTeamSortInverted(false);
    }
  };

  function header(name: TeamSortKey) {
    return (
      <div className="events-overview-header">
        <button
          type="button"
          className="events-overview-sort-button"
          onClick={() => handleSort(name)}
          style={{
            boxShadow:
              teamSortKey === name && !teamSortInverted
                ? "inset 0 2px 0 0 white"
                : teamSortKey === name && teamSortInverted
                  ? "inset 0 -2px 0 0 white"
                  : undefined,
          }}
        >
          {name}
        </button>
      </div>
    );
  }

  return displayEvents.length === 0 ? (
    <div className="card">
      <h1>Events Overview</h1>
      <span className="text-container">{headerMessage}</span>
    </div>
  ) : (
    <div className="wide-card">
      <h1>Events Overview</h1>
      <span className="text-container">{headerMessage}</span>
      {isTeamsDataUpdated ? (
        <div className="x-scroll-container events-overview-container">
          <div
            className="events-overview-row"
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
          {sortedTeams.map((stats) => (
            <button
              key={stats.teamName}
              type="button"
              className="events-overview-row"
              onClick={() => onTeamClick(stats.team)}
              style={{ cursor: "pointer" }}
            >
              <div className="events-overview-item">
                #{rankByTeamName.get(stats.teamName)}
              </div>
              <div className="events-overview-item">
                {stats.teamName.substring(3)}
              </div>
              <div
                style={{
                  color: getStatColor(
                    stats.dataPoints,
                    dataRanges.dataPoints,
                    false,
                  ),
                }}
                className="events-overview-item"
              >
                {stats.dataPoints}
              </div>
              <div
                style={{
                  color: getStatColor(
                    stats.avgScore,
                    dataRanges.avgScore,
                    false,
                  ),
                }}
                className="events-overview-item"
              >
                {stats.avgScore.toFixed(2)}
              </div>
              <div
                style={{
                  color: getStatColor(
                    stats.autoAvgScore,
                    dataRanges.autoAvgScore,
                    false,
                  ),
                }}
                className="events-overview-item"
              >
                {stats.autoAvgScore.toFixed(2)}
              </div>
              <div
                style={{
                  color: getStatColor(
                    stats.teleopAvgScore,
                    dataRanges.teleopAvgScore,
                    false,
                  ),
                }}
                className="events-overview-item"
              >
                {stats.teleopAvgScore.toFixed(2)}
              </div>
              <div
                style={{
                  color: getStatColor(
                    stats.climbAvgScore,
                    dataRanges.climbAvgScore,
                    false,
                  ),
                }}
                className="events-overview-item"
              >
                {stats.climbAvgScore.toFixed(2)}
              </div>
              <div
                style={{
                  color: getStatColor(
                    stats.avgDriverRating,
                    dataRanges.avgDriverRating,
                    false,
                  ),
                }}
                className="events-overview-item"
              >
                {stats.avgDriverRating.toFixed(2)}
              </div>
              <div
                style={{
                  color: getStatColor(
                    stats.avgFouls,
                    dataRanges.avgFouls,
                    true,
                  ),
                }}
                className="events-overview-item"
              >
                {stats.avgFouls.toFixed(2)}
              </div>
              <div
                style={{
                  color: getStatColor(
                    stats.avgTechFouls,
                    dataRanges.avgTechFouls,
                    true,
                  ),
                }}
                className="events-overview-item"
              >
                {stats.avgTechFouls.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <FetchingDataText />
      )}
    </div>
  );
}, pagePropsEqual);
