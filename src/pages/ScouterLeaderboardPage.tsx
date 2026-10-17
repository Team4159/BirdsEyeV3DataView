import { collectionGroup, onSnapshot } from "firebase/firestore";
import type { Firestore } from "firebase/firestore/lite";
import { useEffect, useMemo, useState } from "react";
import { fetchMatchDatasFromEvents } from "../util/databaseFetcher";
import { eventsLabel } from "../util/eventsLabel";

type LeaderboardPageProps = {
  firestore: Firestore;
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
};

export function ScouterLeaderboardPage({
  firestore,
  eventChoices,
  aggregateEvents,
  displayEvents,
}: LeaderboardPageProps) {
  const headerMessage = useMemo(
    () => eventsLabel(eventChoices, aggregateEvents, displayEvents),
    [eventChoices, aggregateEvents, displayEvents],
  );
  const [emailCounts, setEmailCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const emailCountEntries = useMemo(
    () => [...emailCounts.entries()].sort((a, b) => b[1] - a[1]),
    [emailCounts],
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collectionGroup(firestore, "datasets"),
      () => {
        fetchMatchDatasFromEvents(firestore, aggregateEvents).then(
          (aggregatedMatchDatas) => {
            const emailCounts: Map<string, number> = new Map();
            const emailsToDisplay: string[] = [];
            for (const [_, matchData] of aggregatedMatchDatas) {
              for (const matchDataPoint of matchData.getMatchDataPoints()) {
                const email = matchDataPoint.getScouterEmail();
                if (!email) {
                  continue;
                }
                if (!emailsToDisplay.includes(email) && displayEvents.includes(matchData.getEvent())) {
                  emailsToDisplay.push(email);
                }
                const currentCount = emailCounts.get(email) ?? 0;
                emailCounts.set(email, currentCount + 1);
              }
            }
            emailCounts.forEach((_, email) => {
              if (emailsToDisplay.includes(email)) {
                return;
              }
              emailCounts.delete(email);
            })
            setEmailCounts(emailCounts);
          },
        );
      },
    );
    return unsubscribe;
  }, [aggregateEvents, displayEvents, firestore]);

  return displayEvents.length === 0 ? (
    <div className="card">
      <h1>Scouter Leaderboard</h1>
      <span className="text-container">{headerMessage}</span>
    </div>
  ) : (
    <div className="wide-card">
      <h1>Scouter Leaderboard</h1>
      <span className="text-container">{headerMessage}</span>
      <div
        className="scouter-leaderboard-container"
        style={{
          paddingTop: "8px",
          marginTop: "18px",
        }}
      >
        {emailCountEntries.map(([email, count]) => (
          <div key={email} className="scouter-leaderboard-row">
            <div className="scouting-leaderboard-item">{`#${emailCountEntries.findIndex((entry) => entry[0] === email) + 1}`}</div>
            <div className="scouting-leaderboard-item">{email}</div>
            <div className="scouting-leaderboard-item">{count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
