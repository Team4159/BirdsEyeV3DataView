import { useMemo, useRef, useState } from "react";
import {
  createDataRange,
  type DataRange,
  extendDataRange,
} from "../util/DataRange";
import { eventsLabel } from "../util/eventsLabel";
import type { FrcTeam } from "../util/FrcTeam";
import { getStatColor } from "../util/getStatColor";
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
    extendDataRange(dataRanges.avgScore, team.getAvgPoints());
    extendDataRange(dataRanges.autoAvgScore, team.getAvgAutoPoints());
    extendDataRange(dataRanges.teleopAvgScore, team.getAvgTeleopPoints());
    extendDataRange(dataRanges.climbAvgScore, team.getAvgClimbPoints());
    extendDataRange(dataRanges.dataPoints, team.getDataPoints());
    extendDataRange(dataRanges.avgDriverRating, team.getAvgDriverRating());
    extendDataRange(dataRanges.avgFouls, team.getAvgFouls());
    extendDataRange(dataRanges.avgTechFouls, team.getAvgTechFouls());
  });
  return dataRanges;
}

type TeamSortComparator = (a: FrcTeam, b: FrcTeam) => number;
const createTeamSortComparator = (comparator: TeamSortComparator) =>
  ((a, b) =>
    comparator(a, b) ||
    b.getAvgPoints() - a.getAvgPoints() ||
    b.getTeamName().localeCompare(a.getTeamName())) as TeamSortComparator;
const teamSortComparators = {
  Rank: createTeamSortComparator((a, b) => b.getAvgPoints() - a.getAvgPoints()),
  Total: createTeamSortComparator(
    (a, b) => b.getAvgPoints() - a.getAvgPoints(),
  ),
  Auto: createTeamSortComparator(
    (a, b) => b.getAvgAutoPoints() - a.getAvgAutoPoints(),
  ),
  Teleop: createTeamSortComparator(
    (a, b) => b.getAvgTeleopPoints() - a.getAvgTeleopPoints(),
  ),
  Climb: createTeamSortComparator(
    (a, b) => b.getAvgClimbPoints() - a.getAvgClimbPoints(),
  ),
  "Driver Rating": createTeamSortComparator(
    (a, b) => b.getAvgDriverRating() - a.getAvgDriverRating(),
  ),
  Fouls: createTeamSortComparator((a, b) => a.getAvgFouls() - b.getAvgFouls()),
  "Major Fouls": createTeamSortComparator(
    (a, b) => a.getAvgTechFouls() - b.getAvgTechFouls(),
  ),
  Data: createTeamSortComparator(
    (a, b) => b.getDataPoints() - a.getDataPoints(),
  ),
  Team: createTeamSortComparator(
    (a, b) =>
      parseInt(b.getTeamName().substring(3), 10) -
        parseInt(a.getTeamName().substring(3), 10) ||
      b.getTeamName().localeCompare(a.getTeamName()),
  ),
} as const satisfies Record<string, TeamSortComparator>;

function getTeamSortComparator(
  key: keyof typeof teamSortComparators,
  inverted: boolean,
): TeamSortComparator {
  const invert = inverted ? -1 : 1;
  return (a, b) => teamSortComparators[key](a, b) * invert;
}

type EventsOverviewPageProps = {
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
  teams: FrcTeam[];
  onTeamClick: (team: FrcTeam) => void;
};

export function EventsOverviewPage({
  eventChoices,
  aggregateEvents,
  displayEvents,
  teams,
  onTeamClick,
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

  const dataRanges = useMemo(
    () => calculateDataRanges(displayedTeams),
    [displayedTeams],
  );
  const teamSortComparatorKey =
    useRef<keyof typeof teamSortComparators>("Rank");
  const teamSortComparatorInverted = useRef<boolean>(false);
  const [teamSortComparator, setTeamSortComparator] =
    useState<TeamSortComparator>(() =>
      getTeamSortComparator(
        teamSortComparatorKey.current,
        teamSortComparatorInverted.current,
      ),
    );
  const sortedTeams = useMemo(
    () => displayedTeams.toSorted(teamSortComparator),
    [displayedTeams, teamSortComparator],
  );
  const sortedTeamsByPoints = useMemo(
    () => displayedTeams.toSorted(teamSortComparators.Rank),
    [displayedTeams],
  );

  const handleSort = (key: keyof typeof teamSortComparators) => {
    if (teamSortComparators[key]) {
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

  function header(name: keyof typeof teamSortComparators) {
    return (
      <div className="events-overview-header">
        <button
          type="button"
          className="events-overview-sort-button"
          onClick={() => handleSort(name)}
          style={{
            boxShadow:
              teamSortComparatorKey.current === name &&
              !teamSortComparatorInverted.current
                ? "inset 0 2px 0 0 white"
                : teamSortComparatorKey.current === name &&
                    teamSortComparatorInverted.current
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
        {sortedTeams.map((team) => (
          <button
            key={team.getTeamName()}
            type="button"
            className="events-overview-row"
            onClick={() => onTeamClick(team)}
            style={{ cursor: "pointer" }}
          >
            <div className="events-overview-item">
              #{sortedTeamsByPoints.indexOf(team) + 1}
            </div>
            <div className="events-overview-item">
              {team.getTeamName().substring(3)}
            </div>
            <div
              style={{
                color: getStatColor(
                  team.getDataPoints(),
                  dataRanges.dataPoints,
                  false,
                ),
              }}
              className="events-overview-item"
            >
              {team.getDataPoints()}
            </div>
            <div
              style={{
                color: getStatColor(
                  team.getAvgPoints(),
                  dataRanges.avgScore,
                  false,
                ),
              }}
              className="events-overview-item"
            >
              {team.getAvgPoints().toFixed(2)}
            </div>
            <div
              style={{
                color: getStatColor(
                  team.getAvgAutoPoints(),
                  dataRanges.autoAvgScore,
                  false,
                ),
              }}
              className="events-overview-item"
            >
              {team.getAvgAutoPoints().toFixed(2)}
            </div>
            <div
              style={{
                color: getStatColor(
                  team.getAvgTeleopPoints(),
                  dataRanges.teleopAvgScore,
                  false,
                ),
              }}
              className="events-overview-item"
            >
              {team.getAvgTeleopPoints().toFixed(2)}
            </div>
            <div
              style={{
                color: getStatColor(
                  team.getAvgClimbPoints(),
                  dataRanges.climbAvgScore,
                  false,
                ),
              }}
              className="events-overview-item"
            >
              {team.getAvgClimbPoints().toFixed(2)}
            </div>
            <div
              style={{
                color: getStatColor(
                  team.getAvgDriverRating(),
                  dataRanges.avgDriverRating,
                  false,
                ),
              }}
              className="events-overview-item"
            >
              {team.getAvgDriverRating().toFixed(2)}
            </div>
            <div
              style={{
                color: getStatColor(
                  team.getAvgFouls(),
                  dataRanges.avgFouls,
                  true,
                ),
              }}
              className="events-overview-item"
            >
              {team.getAvgFouls().toFixed(2)}
            </div>
            <div
              style={{
                color: getStatColor(
                  team.getAvgTechFouls(),
                  dataRanges.avgTechFouls,
                  true,
                ),
              }}
              className="events-overview-item"
            >
              {team.getAvgTechFouls().toFixed(2)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
