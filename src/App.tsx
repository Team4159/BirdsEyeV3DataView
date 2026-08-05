import { useCallback, useEffect, useRef, useState } from "react";
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
import { TeamsDisplay } from "./ui/TeamsDisplay";
import { FrcTeam } from "./util/FrcTeam";
import { MatchData } from "./util/matchData";
import { MatchLineGraph } from "./ui/MatchLineGraph";
import { ScoringPercentagePiChart } from "./ui/ScoringPercentagePiChart";
import { MatchStats } from "./ui/MatchStats";
import { GoogleLogin } from "@react-oauth/google";
import { logInWithGoogle } from "./firebase/auth";
import { getEvents } from "./util/getEvents";
import { getTeamsFromEvents } from "./util/getTeams";
import { MatchDataPoint } from "./util/matchDataPoint";
import { MatchDataPointStats } from "./ui/MatchDataPointStats";

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

function App() {
  const [currentPage, setCurrentPage] = useState("login");
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
    const loadData = async () => {
      setEventChoices(await getEvents(firestore));
      // await updateTeams(firestore);
    };

    loadData();
  }, []);

  useEffect(() => {
    if (currentPage !== "login") {
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

  return (
    <div>
      {currentPage === "login" && (
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            logInWithGoogle(credentialResponse);
            setCurrentPage("Home");
          }}
          onError={() => {
            console.log("Login Failed");
          }}
        />
      )}

      {/* {currentPage !== "login" && ( */}
      <div className="eventButtonRow">
        {eventChoices.map((event, index) => (
          <button
            key={index}
            onClick={() => toggleEvent(event)}
            style={{
              backgroundColor: events.includes(event) ? "#4CAF50" : "#ccc",
              margin: "4px",
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            {event}
          </button>
        ))}
      </div>
      {/* )} */}

      {currentPage === "Home" && (
        <div>
          <h1>All Teams</h1>
          <TeamsDisplay
            teams={teams}
            events={events}
            onTeamClick={(team: FrcTeam) => {
              setSelectedTeam(team);
              setCurrentPage("TeamDetails");
            }}
          ></TeamsDisplay>
        </div>
      )}

      {currentPage === "TeamDetails" && selectedTeam && (
        <div>
          <button className="backButton" onClick={() => setCurrentPage("Home")}>
            Back
          </button>
          <h1>Team {selectedTeam.getTeamName().substring(3)}</h1>
          <MatchLineGraph team={selectedTeam} events={events}></MatchLineGraph>
          <div className="sidebyside">
            <ScoringPercentagePiChart
              autoFuel={selectedTeam.getAvgAutoFuelPoints()}
              teleopFuel={selectedTeam.getAvgTeleopPoints()}
              climb={selectedTeam.getAvgClimbPoints()}
            />

            <div className="matchList">
              {selectedTeam.getMatches().map((match, index) => (
                <div
                  key={index}
                  className="datatable"
                  onClick={() => {
                    setSelectedMatch(match);
                    setCurrentPage("MatchDetails");
                  }}
                  style={{
                    cursor: "pointer",
                  }}
                >
                  <span>{match.getEvent() + " " + match.getName()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentPage === "MatchDetails" && selectedTeam && selectedMatch && (
        <div>
          <button
            className="backButton"
            onClick={() => setCurrentPage("TeamDetails")}
          >
            Back
          </button>
          <h1>
            {selectedMatch.getEvent() +
              " " +
              selectedTeam.getTeamName().substring(3) +
              " " +
              selectedMatch.getName()}
          </h1>

          <div className="sidebyside">
            <ScoringPercentagePiChart
              autoFuel={selectedMatch.getAutoFuels()}
              teleopFuel={selectedMatch.getTeleopFuels()}
              climb={selectedMatch.getClimbPoints()}
            />

            <MatchStats match={selectedMatch} />
          </div>
          <div className="matchList">
            {selectedMatch.getMatchDataPoints().map((matchDataPoint, index) => (
              <div
                key={index}
                className="datatable"
                onClick={() => {
                  setSelectedMatchDataPoint(matchDataPoint);
                  setCurrentPage("MatchDataDetails");
                }}
                style={{
                  cursor: "pointer",
                }}
              >
                <span>
                  {"points: " +
                    matchDataPoint.getPoints() +
                    " scouter email: " +
                    matchDataPoint.getScouterEmail()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentPage === "MatchDataDetails" &&
        selectedTeam &&
        selectedMatch &&
        selectedMatchDataPoint && (
          <div>
            <button
              className="backButton"
              onClick={() => setCurrentPage("MatchDetails")}
            >
              Back
            </button>
            <h1>
              {selectedMatch.getEvent() +
                " " +
                selectedTeam.getTeamName().substring(3) +
                " " +
                selectedMatch.getName()}
            </h1>

            <div className="sidebyside">
              <ScoringPercentagePiChart
                autoFuel={selectedMatchDataPoint.getAutoFuels()}
                teleopFuel={selectedMatchDataPoint.getTeleopFuels()}
                climb={selectedMatchDataPoint.getClimbPoints()}
              />

              <MatchDataPointStats matchDataPoint={selectedMatchDataPoint} />
            </div>
          </div>
        )}
    </div>
  );
}

export default App;
