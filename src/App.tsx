import {
  Calendars,
  ChartNoAxesCombined,
  ClipboardPen,
  LogOut,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

//firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
} from "firebase/auth";
import {
  collection,
  collectionGroup,
  type Firestore,
  getFirestore,
  onSnapshot,
} from "firebase/firestore";
import { logOut } from "./firebase/auth";
import { AllianceBuilderPage } from "./pages/AllianceBuilderPage";
import { EventsOverviewPage } from "./pages/EventsOverviewPage";
import { LoginPage } from "./pages/LoginPage";
import { Page } from "./pages/Page";
import { ScouterLeaderboardPage } from "./pages/ScouterLeaderboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { applyDarkMode } from "./ui/theme";
import {
  fetchEvents,
  fetchTeamsFromEvents,
} from "./util/databaseFetcher";
import { FrcTeam } from "./util/FrcTeam";
import type { MatchData } from "./util/matchData";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCk4X0qVprdIYWoMdtTnSs0qVAqR_zcQBY",
  authDomain: "scoutingapp-bd57b.firebaseapp.com",
  projectId: "scoutingapp-bd57b",
  storageBucket: "scoutingapp-bd57b.firebasestorage.app",
  messagingSenderId: "345042135934",
  appId: "1:345042135934:web:3499e51bc4ebde3d5e212f",
  measurementId: "G-Q5EL55034N",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const auth = getAuth(app);

function App() {
  const [autoLoginDone, setAutoLoginDone] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>(Page.Login);
  const [darkMode, _] = useState(true);
  const [teams, setTeams] = useState([new FrcTeam("temp")]);
  //possible events to filter by
  const [eventChoices, setEventChoices] = useState<string[]>([]);
  //events whose data is aggregated
  const [aggregateEvents, setAggregateEvents] = useState<string[]>([]);
  //subset of aggregate events shown in the teams display
  const [displayEvents, setDisplayEvents] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<FrcTeam | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const isDataUpdating = useRef<boolean>(false);
  const dataUpdateIndex = useRef<number>(0);

  const updateData = useCallback(
    async (firestore: Firestore) => {
      const scopeTeamUpdateIndex = dataUpdateIndex.current + 1;
      dataUpdateIndex.current = scopeTeamUpdateIndex;
      const newTeams = await fetchTeamsFromEvents(firestore, aggregateEvents);
      if (scopeTeamUpdateIndex !== dataUpdateIndex.current) {
        return;
      }

      // setEventChoices(await getEvents(firestore));
      setTeams(newTeams);

      if (selectedTeam) {
        const updatedTeam = newTeams.find(
          (t) => t.getTeamName() === selectedTeam.getTeamName(),
        );

        if (updatedTeam) {
          setSelectedTeam(updatedTeam);
        }
      }

      if (selectedMatch && selectedTeam) {
        const updatedTeam = newTeams.find(
          (t) => t.getTeamName() === selectedTeam.getTeamName(),
        );

        const updatedMatch = updatedTeam
          ?.getMatches()
          .find((m) => m.getName() === selectedMatch.getName());

        if (updatedMatch) {
          setSelectedMatch(updatedMatch);
        }
      }
    },
    [aggregateEvents, selectedMatch, selectedTeam],
  );

  function toggleAggregateEvent(event: string) {
    if (aggregateEvents.includes(event)) {
      // removing an aggregate event also turns off its display toggle
      setDisplayEvents((prev) => prev.filter((e) => e !== event));
      setAggregateEvents((prev) => prev.filter((e) => e !== event));
    } else {
      setAggregateEvents((prev) => [...prev, event]);
    }
  }

  // when everything is selected, clicking the button clears the selection instead
  function toggleAllAggregateEvents() {
    if (aggregateEvents.length === eventChoices.length) {
      setAggregateEvents([]);
      setDisplayEvents([]);
    } else {
      setAggregateEvents([...eventChoices]);
    }
  }

  function toggleAllUndisplayedAggregateEvents() {
    if (aggregateEvents.length === displayEvents.length) {
      setAggregateEvents([...eventChoices]);
    } else {
      setAggregateEvents([...displayEvents]);
    }
  }

  function toggleAllDisplayEvents() {
    if (displayEvents.length === aggregateEvents.length) {
      setDisplayEvents([]);
    } else {
      setDisplayEvents([...aggregateEvents]);
    }
  }

  function toggleDisplayEvent(event: string) {
    setDisplayEvents((prev) => {
      if (prev.includes(event)) {
        return prev.filter((e) => e !== event);
      } else {
        return [...prev, event];
      }
    });
  }

  //run when app loads
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      setAutoLoginDone(true);
      if (user != null) {
        setCurrentPage(Page.Settings);
      } else {
        setCurrentPage(Page.Login);
      }
    });
  }, []);

  useEffect(() => {
    if (!autoLoginDone) {
      return;
    }
    if (currentPage === Page.Login) {
      return;
    }
    const unsubscribe = onSnapshot(
      collection(firestore, "events"),
      async () => {
        setEventChoices((await fetchEvents(firestore)).reverse());
      },
    );
    return unsubscribe;
  }, [autoLoginDone, currentPage]);

  useEffect(() => {
    if (!autoLoginDone) {
      return;
    }
    if (currentPage === Page.Login) {
      return;
    }
    const unsubscribe = onSnapshot(
      collectionGroup(firestore, "datasets"),
      async () => {
        if (isDataUpdating.current) {
          return;
        }
        isDataUpdating.current = true;
        await updateData(firestore);
        isDataUpdating.current = false;
      },
    );
    return unsubscribe;
  }, [updateData, autoLoginDone, currentPage]);

  useEffect(() => {
    applyDarkMode(darkMode);
  }, [darkMode]);

  return (
    <main>
      {currentPage === Page.Login && autoLoginDone && (
        <LoginPage
          onSuccess={async (credentialResponse) => {
            const credential = GoogleAuthProvider.credential(
              credentialResponse.credential,
            );
            await signInWithCredential(auth, credential);
            setCurrentPage(Page.Settings);
          }}
        />
      )}

      {currentPage !== Page.Login && (
        <nav className="navbar">
          <button
            type="button"
            onClick={() => {
              setCurrentPage(Page.Settings);
            }}
          >
            <Calendars size={20} />
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(Page.EventsOverview);
            }}
          >
            <ChartNoAxesCombined size={20} />
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(Page.AllianceBuilder);
            }}
          >
            <ClipboardPen size={20} />
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(Page.ScouterLeaderboard);
            }}
          >
            <Trophy size={20} />
          </button>

          <button
            type="button"
            onClick={() => {
              logOut();
              setCurrentPage(Page.Login);
            }}
          >
            <LogOut size={20} />
          </button>
        </nav>
      )}

      {currentPage === Page.Settings && (
        <SettingsPage
          aggregateEvents={aggregateEvents}
          eventChoices={eventChoices}
          displayEvents={displayEvents}
          toggleAggregateEvent={toggleAggregateEvent}
          toggleDisplayEvent={toggleDisplayEvent}
          toggleAllAggregateEvents={toggleAllAggregateEvents}
          toggleAllUndisplayedAggregateEvents={toggleAllUndisplayedAggregateEvents}
          toggleAllDisplayEvents={toggleAllDisplayEvents}
        />
      )}

      <div hidden={currentPage !== Page.EventsOverview}>
        <EventsOverviewPage
          eventChoices={eventChoices}
          aggregateEvents={aggregateEvents}
          displayEvents={displayEvents}
          teams={teams}
          onTeamClick={(team) => {
            setSelectedTeam(team);
            // setCurrentPage(Page.TeamOverview);
          }}
        />
      </div>

      {/*{currentPage === Page.TeamOverview && (
        <TeamOverviewPage selectedTeam={selectedTeam} />
      )}*/}

      <div hidden={currentPage !== Page.AllianceBuilder}>
        <AllianceBuilderPage
          eventChoices={eventChoices}
          aggregateEvents={aggregateEvents}
          displayEvents={displayEvents}
          teams={teams}
        />
      </div>

      <div hidden={currentPage !== Page.ScouterLeaderboard}>
        <ScouterLeaderboardPage
          firestore={firestore}
          eventChoices={eventChoices}
          aggregateEvents={aggregateEvents}
          displayEvents={displayEvents}
        />
      </div>
    </main>
  );
}

export default App;
