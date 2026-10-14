import { useMemo } from "react";
import { eventsLabel } from "../util/eventsLabel";

type LeaderboardPageProps = {
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
};

export function LeaderboardPage({
  eventChoices,
  aggregateEvents,
  displayEvents,
}: LeaderboardPageProps) {
  const headerMessage = useMemo(
    () => eventsLabel(eventChoices, aggregateEvents, displayEvents),
    [eventChoices, aggregateEvents, displayEvents],
  );

  return displayEvents.length === 0 ? (
    <div className="card">
      <h1>Leaderboard</h1>
      <span className="text-container">{headerMessage}</span>
    </div>
  ) : (
    <div className="wide-card">
      <h1>Leaderboard</h1>
      <span className="text-container">{headerMessage}</span>
      <div className="xy-scroll-container"></div>
    </div>
  );
}
