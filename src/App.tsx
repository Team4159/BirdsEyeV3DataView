import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, ListOrdered, Calendars, Sun, Moon } from "lucide-react";
import "./App.css";

//firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  Firestore,
  onSnapshot,
  collection,
  collectionGroup,
} from "firebase/firestore";
import { FrcTeam } from "./util/FrcTeam";
import { MatchData } from "./util/matchData";
import { getEvents } from "./util/getEvents";
import { getTeamsFromEvents } from "./util/getTeams";
import { MatchDataPoint } from "./util/matchDataPoint";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
} from "firebase/auth";
import { LoginPage } from "./pages/LoginPage";
import { logOut } from "./firebase/auth";
import { PageEnum } from "./pages/PageEnum";
import { applyDarkMode } from "./ui/theme";
import { SettingsPage } from "./pages/SettingsPage";

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
  const [darkMode, setDarkMode] = useState(true);
  const [teams, setTeams] = useState([new FrcTeam("temp")]);
  //possible events to filter by
  const [eventChoices, setEventChoices] = useState<string[]>([]);
  //current event filters
  const [events, setEvents] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<FrcTeam | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [selectedMatchDataPoint, setSelectedMatchDataPoint] =
    useState<MatchDataPoint | null>(null);
  const teamUpdateIndex = useRef(0);

  const updateTeams = useCallback(
    async (firestore: Firestore) => {
      const scopeTeamUpdateIndex = teamUpdateIndex.current + 1;
      teamUpdateIndex.current = scopeTeamUpdateIndex;
      const newTeams = await getTeamsFromEvents(firestore, events);
      if (scopeTeamUpdateIndex != teamUpdateIndex.current) {
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
    [events, selectedMatch, selectedTeam, teamUpdateIndex],
  );

  function toggleEvent(event: string) {
    setEvents((prev) => {
      if (prev.includes(event)) {
        // remove event
        return prev.filter((e) => e !== event);
      } else {
        // add event
        console.log("add:", event);
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
  }, [currentPage, events, updateTeams]); // run whenever currentPage changes

  useEffect(() => {
    (async () => {
      updateTeams(firestore);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

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
            setCurrentPage("home");
          }}
        />
      )}

      {currentPage !== PageEnum.Login && (
        <nav className="navBar">
          <button
            onClick={() => {
              setDarkMode((p) => !p);
            }}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

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
            <ListOrdered size={20} />
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
          events={events}
          eventChoices={eventChoices}
          toggleEvent={toggleEvent}
        />
      )}
    </main>
  );
}

export default App;
