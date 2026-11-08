import {
  collectionGroup,
  onSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore/lite";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FetchingDataText } from "../ui/FetchingDataText";
import { eventsLabel } from "../util/eventsLabel";
import { matchDataPointFromFirestore } from "../util/matchDataPoint";
import { pagePropsEqual } from "../util/pagePropsEqual";

type LeaderboardPageProps = {
  firestore: Firestore;
  eventChoices: string[];
  aggregateEvents: string[];
  displayEvents: string[];
  isActive: boolean;
  isTeamsDataUpdated: boolean;
};

function getLeaderboardCounts(
  snapshot: QuerySnapshot,
  aggregateEvents: string[],
  displayEvents: string[],
) {
  const aggregateEventSet = new Set(aggregateEvents);
  const displayEventSet = new Set(displayEvents);
  const emailCounts = new Map<string, number>();
  const emailsToDisplay = new Set<string>();

  for (const doc of snapshot.docs) {
    const event = doc.ref.path.split("/")[1];
    if (!event || !aggregateEventSet.has(event)) {
      continue;
    }

    const email = matchDataPointFromFirestore(doc.data()).getScouterEmail();
    if (!email) {
      continue;
    }

    if (displayEventSet.has(event)) {
      emailsToDisplay.add(email);
    }
    emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }

  let total = 0;
  emailCounts.forEach((count, email) => {
    if (emailsToDisplay.has(email)) {
      total += count;
    } else {
      emailCounts.delete(email);
    }
  });

  return { emailCounts, total };
}

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
    () => [...emailCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
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
  const latestFilters = useRef({
    aggregateEvents,
    displayEvents,
    isActive,
  });
  const latestSnapshot = useRef<QuerySnapshot | null>(null);

  useEffect(() => {
    latestFilters.current = { aggregateEvents, displayEvents, isActive };
    if (!isActive || !latestSnapshot.current) {
      return;
    }

    const { emailCounts, total } = getLeaderboardCounts(
      latestSnapshot.current,
      aggregateEvents,
      displayEvents,
    );
    setTotal(total);
    setEmailCounts(emailCounts);
  }, [aggregateEvents, displayEvents, isActive]);

  useEffect(
    () =>
      onSnapshot(collectionGroup(firestore, "datasets"), (snapshot) => {
        latestSnapshot.current = snapshot;
        const filters = latestFilters.current;
        if (!filters.isActive) {
          return;
        }

        const { emailCounts, total } = getLeaderboardCounts(
          snapshot,
          filters.aggregateEvents,
          filters.displayEvents,
        );
        setTotal(total);
        setEmailCounts(emailCounts);
      }),
    [firestore],
  );

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
