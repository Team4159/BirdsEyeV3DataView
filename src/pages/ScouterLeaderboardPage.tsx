import { collectionGroup, onSnapshot } from "firebase/firestore";
import type { Firestore } from "firebase/firestore/lite";
import { memo, useEffect, useMemo, useState } from "react";
import { FetchingDataText } from "../ui/FetchingDataText";
import { fetchMatchDatasFromEvents } from "../util/databaseFetcher";
import { eventsLabel } from "../util/eventsLabel";
import { pagePropsEqual } from "../util/pagePropsEqual";

type LeaderboardPageProps = {
  firestore: Firestore;
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
  isActive: boolean;
  isTeamsDataUpdated: boolean;
};

export const ScouterLeaderboardPage = memo(function ScouterLeaderboardPage({
  firestore,
  eventChoices,
  aggregateEvents,
  displayEvents,
  isActive,
  isTeamsDataUpdated,
}: LeaderboardPageProps) {
  const headerMessage = useMemo(
    () => eventsLabel(eventChoices, aggregateEvents, displayEvents),
    [eventChoices, aggregateEvents, displayEvents],
  );
  const [emailCounts, setEmailCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [total, setTotal] = useState<number>(0);
  const emailCountEntries = useMemo(
    () => [...emailCounts.entries()].sort((a, b) => b[1] - a[1]),
    [emailCounts],
  );
  const rankByEmail = useMemo(
    () =>
      new Map(
        emailCountEntries.map(([email], index): [string, number] => [
          email,
          index + 1,
        ]),
      ),
    [emailCountEntries],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let isCurrentSubscription = true;
    const unsubscribe = onSnapshot(
      collectionGroup(firestore, "datasets"),
      () => {
        fetchMatchDatasFromEvents(firestore, aggregateEvents).then(
          (aggregatedMatchDatas) => {
            if (!isCurrentSubscription) {
              return;
            }
            const emailCounts: Map<string, number> = new Map();
            const emailsToDisplay = new Set<string>();
            const displayEventSet = new Set(displayEvents);
            for (const [_, matchData] of aggregatedMatchDatas) {
              for (const matchDataPoint of matchData.getMatchDataPoints()) {
                const email = matchDataPoint.getScouterEmail();
                if (!email) {
                  continue;
                }
                if (displayEventSet.has(matchData.getEvent())) {
                  emailsToDisplay.add(email);
                }
                const currentCount = emailCounts.get(email) ?? 0;
                emailCounts.set(email, currentCount + 1);
              }
            }
            let total = 0;
            emailCounts.forEach((count, email) => {
              if (emailsToDisplay.has(email)) {
                total += count;
              } else {
                emailCounts.delete(email);
              }
            });
            setTotal(total);
            setEmailCounts(emailCounts);
          },
        );
      },
    );
    return () => {
      isCurrentSubscription = false;
      unsubscribe();
    };
  }, [aggregateEvents, displayEvents, firestore, isActive]);

  return displayEvents.length === 0 ? (
    <div className="card">
      <h1>Scouter Leaderboard</h1>
      <span className="text-container">{headerMessage}</span>
    </div>
  ) : (
    <div className="wide-card">
      <h1>Scouter Leaderboard</h1>
      <span className="text-container">{headerMessage}</span>
      {isTeamsDataUpdated ? (
        <>
          <span className="text-container">{`Total: ${total}`}</span>
          <div
            className="scouter-leaderboard-container"
            style={{
              paddingTop: "8px",
              marginTop: "18px",
            }}
          >
            {emailCountEntries.map(([email, count]) => (
              <div key={email} className="scouter-leaderboard-row">
                <div className="scouting-leaderboard-item">{`#${rankByEmail.get(email)}`}</div>
                <div className="scouting-leaderboard-item">{email}</div>
                <div className="scouting-leaderboard-item">{count}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <FetchingDataText />
      )}
    </div>
  );
}, pagePropsEqual);
