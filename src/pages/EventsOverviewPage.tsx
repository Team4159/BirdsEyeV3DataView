import { useMemo, useRef, useState } from "react";
import {
  createDataRange,
  type DataRange,
  extendDataRange,
} from "../util/DataRange";
import { eventsLabel } from "../util/eventsLabel";
import { FrcTeam } from "../util/FrcTeam";
import { getStatColor } from "../util/getStatColor";

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
  Team: createTeamSortComparator((a, b) =>
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
      if (matches.length === 0) {
        return [];
      }
      const filteredTeam = new FrcTeam(team.getTeamName());
      matches.forEach((match) => {
        filteredTeam.addMatch(match);
      });
      return [filteredTeam];
    });
  }, [teams, displayEvents]);

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
    () => teams.toSorted(teamSortComparator),
    [teams, teamSortComparator],
  );
  const sortedTeamsByPoints = useMemo(
    () => teams.toSorted(teamSortComparators.Rank),
    [teams],
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

  const onTeamClick = console.log;

  function header(name: keyof typeof teamSortComparators) {
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

  return displayEvents.length === 0 ? (
    <div className="card">
      <h1>Events Overview</h1>
      <span className="text-container">{headerMessage}</span>
    </div>
  ) : (
    <div className="wide-card">
      <h1>Events Overview</h1>
      <span className="text-container">{headerMessage}</span>
      <div className="xy-scroll-container">
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
                  color: getStatColor(
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
                  color: getStatColor(
                    team.getAvgPoints(),
                    dataRanges.avgScore,
                    false,
                  ),
                }}
                className="teams-display-item"
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
                className="teams-display-item"
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
                className="teams-display-item"
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
                className="teams-display-item"
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
                className="teams-display-item"
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
                className="teams-display-item"
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
                className="teams-display-item"
              >
                {team.getAvgTechFouls().toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
