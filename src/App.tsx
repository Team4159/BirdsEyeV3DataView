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
import type { MatchDataPoint } from "./util/matchDataPoint";

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
  //current event filters
  const [eventsChosen, setEventsSelected] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<FrcTeam | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const teamUpdateIndex = useRef(0);

  const updateTeams = useCallback(
    async (firestore: Firestore) => {
      const scopeTeamUpdateIndex = teamUpdateIndex.current + 1;
      teamUpdateIndex.current = scopeTeamUpdateIndex;
      const newTeams = await getTeamsFromEvents(firestore, eventsChosen);
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
    [eventsChosen, selectedMatch, selectedTeam, teamUpdateIndex],
  );

  function toggleEvent(event: string) {
    setEventsSelected((prev) => {
      if (prev.includes(event)) {
        // remove event
        return prev.filter((e) => e !== event);
      } else {
        // add event
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
    (async () => {
      updateTeams(firestore);
    })();
  }, [updateTeams]);

  useEffect(() => {
    let isUpdating = false;

    const unsubscribe = onSnapshot(
      collectionGroup(firestore, "datasets"),
      async () => {
        if (isUpdating) return;

        isUpdating = true;

        // await updateTeams(firestore);

        isUpdating = false;
      },
    );

    return unsubscribe;
  }, []);

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
            setCurrentPage("home");
          }}
        />
      )}

      {currentPage !== PageEnum.Login && (
        <nav className="navBar">
          <button
            onClick={() => {
              setCurrentPage(PageEnum.Settings);
            }}
          >
            <Calendars size={20} />
          </button>

          <button
            onClick={() => {
              setCurrentPage(PageEnum.EventsOverview);
            }}
          >
            <ChartNoAxesCombined size={20} />
          </button>

          <button
            onClick={() => {
              setCurrentPage(PageEnum.AllianceBuilder);
            }}
          >
            <ClipboardPen size={20} />
          </button>

          <button
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
          eventsChosen={eventsChosen}
          eventChoices={eventChoices}
          toggleEvent={toggleEvent}
        />
      )}

      {currentPage === PageEnum.EventsOverview && (
        <EventsOverviewPage eventsChosen={eventsChosen} teams={teams} />
      )}

      {currentPage === PageEnum.AllianceBuilder && <AllianceBuilderPage />}
    </main>
  );
}

export default App;
