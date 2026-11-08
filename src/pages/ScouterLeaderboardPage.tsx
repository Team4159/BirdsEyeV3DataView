import {
  onSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore/lite";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { getScoutedEventDatasetsQuery } from "../firebase/fetchScoutedData";
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
  docs: QueryDocumentSnapshot[],
  aggregateEvents: string[],
  displayEvents: string[],
) {
  const aggregateEventSet = new Set(aggregateEvents);
  const displayEventSet = new Set(displayEvents);
  const emailCounts = new Map<string, number>();
  const emailsToDisplay = new Set<string>();

  for (const doc of docs) {
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

  emailCounts.forEach((_, email) => {
    if (!emailsToDisplay.has(email)) {
      emailCounts.delete(email);
    }
  });

  return emailCounts;
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
  const [emailDataAggregateEvents, setEmailDataAggregateEvents] = useState<
    string[] | null
  >(null);
  const isEmailDataUpdated = emailDataAggregateEvents === aggregateEvents;
  const emailCountEntries = useMemo(
    () =>
      [...emailCounts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
    [emailCounts],
  );
  const total = useMemo(
    () => emailCountEntries.reduce((sum, [, count]) => sum + count, 0),
    [emailCountEntries],
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
  const latestEventDocs = useRef(
    new Map<string, QueryDocumentSnapshot[]>(),
  );

  useEffect(() => {
    latestFilters.current = { aggregateEvents, displayEvents, isActive };
    if (!isActive || emailDataAggregateEvents !== aggregateEvents) {
      return;
    }

    const emailCounts = getLeaderboardCounts(
      [...latestEventDocs.current.values()].flat(),
      aggregateEvents,
      displayEvents,
    );
    setEmailCounts(emailCounts);
    setEmailDataAggregateEvents(aggregateEvents);
  }, [aggregateEvents, displayEvents, emailDataAggregateEvents, isActive]);

  useEffect(() => {
    latestEventDocs.current = new Map();
    setEmailDataAggregateEvents(null);

    const pendingInitialSnapshots = new Set(aggregateEvents);
    const publishCounts = () => {
      const filters = latestFilters.current;
      if (!filters.isActive) {
        return;
      }

      setEmailCounts(
        getLeaderboardCounts(
          [...latestEventDocs.current.values()].flat(),
          filters.aggregateEvents,
          filters.displayEvents,
        ),
      );
      setEmailDataAggregateEvents(filters.aggregateEvents);
    };

    if (aggregateEvents.length === 0) {
      publishCounts();
      return;
    }

    const unsubscribe = aggregateEvents.map((event) =>
      onSnapshot(getScoutedEventDatasetsQuery(firestore, event), (snapshot) => {
        latestEventDocs.current.set(event, snapshot.docs);
        pendingInitialSnapshots.delete(event);
        if (pendingInitialSnapshots.size === 0) {
          publishCounts();
        }
      }),
    );
    return () => {
      unsubscribe.forEach((stop) => {
        stop();
      });
    };
  }, [aggregateEvents, firestore]);

  return displayEvents.length === 0 ? (
    <div className="card">
      <h1>Scouter Leaderboard</h1>
      <span className="text-container">{headerMessage}</span>
    </div>
  ) : (
    <div className="wide-card">
      <h1>Scouter Leaderboard</h1>
      <span className="text-container">{headerMessage}</span>
      {isTeamsDataUpdated && isEmailDataUpdated ? (
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
                <div className="scouting-leaderboard-item">
                  {`#${rankByEmail.get(email)}`}
                </div>
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
