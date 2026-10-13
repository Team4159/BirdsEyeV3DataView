import {
  Calendars,
  ChartNoAxesCombined,
  ClipboardPen,
  LogOut,
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
import { PageEnum } from "./pages/PageEnum";
import { SettingsPage } from "./pages/SettingsPage";
import { applyDarkMode } from "./ui/theme";
import { FrcTeam } from "./util/FrcTeam";
import { getEvents } from "./util/getEvents";
import { getTeamsFromEvents } from "./util/getTeams";
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
  const [currentPage, setCurrentPage] = useState<string>(PageEnum.Login);
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
  const teamUpdateIndex = useRef(0);

  const updateTeams = useCallback(
    async (firestore: Firestore) => {
      const scopeTeamUpdateIndex = teamUpdateIndex.current + 1;
      teamUpdateIndex.current = scopeTeamUpdateIndex;
      const newTeams = await getTeamsFromEvents(firestore, aggregateEvents);
      if (scopeTeamUpdateIndex !== teamUpdateIndex.current) {
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
    // load data
    (async () => {
      setEventChoices(await getEvents(firestore));
      // await updateTeams(firestore);
    })();

    onAuthStateChanged(auth, (user) => {
      setAutoLoginDone(true);
      if (user != null) {
        setCurrentPage(PageEnum.Settings);
      } else {
        setCurrentPage(PageEnum.Login);
      }
    });
  }, []);

  useEffect(() => {
    if (currentPage !== PageEnum.Login) {
      const unsubscribe = onSnapshot(
        collection(firestore, "events"),
        async () => {
          setEventChoices(await getEvents(firestore));
          // await updateTeams(firestore);
        },
      );

      return () => unsubscribe();
    }
  }, [currentPage]); // run whenever currentPage changes

  useEffect(() => {
    let isUpdating = false;
    const unsubscribe = onSnapshot(
      collectionGroup(firestore, "datasets"),
      async () => {
        if (isUpdating) return;
        isUpdating = true;
        await updateTeams(firestore);
        isUpdating = false;
      },
    );

    return unsubscribe;
  }, [updateTeams]);

  useEffect(() => {
    applyDarkMode(darkMode);
  }, [darkMode]);

  return (
    <main>
      {currentPage === PageEnum.Login && autoLoginDone && (
        <LoginPage
          onSuccess={async (credentialResponse) => {
            const credential = GoogleAuthProvider.credential(
              credentialResponse.credential,
            );
            await signInWithCredential(auth, credential);
            setCurrentPage(PageEnum.Settings);
          }}
        />
      )}

      {currentPage !== PageEnum.Login && (
        <nav className="navbar">
          <button
            type="button"
            onClick={() => {
              setCurrentPage(PageEnum.Settings);
            }}
          >
            <Calendars size={20} />
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(PageEnum.EventsOverview);
            }}
          >
            <ChartNoAxesCombined size={20} />
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(PageEnum.AllianceBuilder);
            }}
          >
            <ClipboardPen size={20} />
          </button>

          <button
            type="button"
            onClick={() => {
              logOut();
              setCurrentPage(PageEnum.Login);
            }}
          >
            <LogOut size={20} />
          </button>
        </nav>
      )}

      {currentPage === PageEnum.Settings && (
        <SettingsPage
          aggregateEvents={aggregateEvents}
          eventChoices={eventChoices}
          displayEvents={displayEvents}
          toggleAggregateEvent={toggleAggregateEvent}
          toggleDisplayEvent={toggleDisplayEvent}
          toggleAllAggregateEvents={toggleAllAggregateEvents}
          toggleAllDisplayEvents={toggleAllDisplayEvents}
        />
      )}

      <div hidden={currentPage !== PageEnum.EventsOverview}>
        <EventsOverviewPage
          eventChoices={eventChoices}
          aggregateEvents={aggregateEvents}
          displayEvents={displayEvents}
          teams={teams}
        />
      </div>

      <div hidden={currentPage !== PageEnum.AllianceBuilder}>
        <AllianceBuilderPage
          eventChoices={eventChoices}
          aggregateEvents={aggregateEvents}
          displayEvents={displayEvents}
          teams={teams}
        />
      </div>
    </main>
  );
}

export default App;
