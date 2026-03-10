import { useEffect, useState } from 'react'
import './App.css'

//firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, Firestore, onSnapshot, collection } from "firebase/firestore";
import { getTeams } from './util/GetTeams';
import { TeamsDisplay } from './ui/TeamsDisplay';
import { FRCTeam } from './util/FRCTeam';
import { MatchData } from './util/MatchData';
import { MatchLineGraph } from './ui/MatchLineGraph';
import { ScoringPercentagePiChart } from './ui/ScoringPercentagePiChart';
import { MatchStats } from './ui/MatchStats';
import { getEventsFromTeams } from './util/GetEvents';
import { Login } from './ui/Login';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
apiKey: "AIzaSyCk4X0qVprdIYWoMdtTnSs0qVAqR_zcQBY",
authDomain: "scoutingapp-bd57b.firebaseapp.com",
projectId: "scoutingapp-bd57b",
storageBucket: "scoutingapp-bd57b.firebasestorage.app",
messagingSenderId: "345042135934",
appId: "1:345042135934:web:3499e51bc4ebde3d5e212f",
measurementId: "G-Q5EL55034N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

function App() {
  const [currentPage, setCurrentPage] = useState("login");
  const [teams, setTeams] = useState([new FRCTeam("temp")]);
  //possible events to filter by
  const [eventChoices, setEventChoices] = useState<string[]>([]);
  //current event filters
  const [events, setEvents] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<FRCTeam | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);

  //run when app loads
  useEffect(() => {
    updateTeams(firestore);
  }, []);

  useEffect(() => {
    if (currentPage !== "login") {
      console.log("Setting up Firestore listener");

      const unsubscribe = onSnapshot(
        collection(firestore, "matches"),
        async () => {
          console.log("Firestore matches changed");
          updateTeams(firestore);
        }
      );

      return () => unsubscribe();
    }
  }, [currentPage]); // run whenever currentPage changes

  async function updateTeams(firestore: Firestore){
    const newTeams = await getTeams(firestore);

    setTeams(newTeams);
    setEventChoices(getEventsFromTeams(newTeams));

    if (selectedTeam) {
      const updatedTeam = newTeams.find(
        (t) => t.getTeamName() === selectedTeam.getTeamName()
      );

      if (updatedTeam) {
        setSelectedTeam(updatedTeam);
      }
    }

    if (selectedMatch && selectedTeam) {
      const updatedTeam = newTeams.find(
        (t) => t.getTeamName() === selectedTeam.getTeamName()
      );

      const updatedMatch = updatedTeam
        ?.getMatches()
        .find((m) => m.getName() === selectedMatch.getName());

      if (updatedMatch) {
        setSelectedMatch(updatedMatch);
      }
    }
  }

  function toggleEvent(event: string) {
    setEvents((prev) => {
      if (prev.includes(event)) {
        // remove event
        return prev.filter(e => e !== event);
      } else {
        // add event
        return [...prev, event];
      }
    });
  }

  return (
    <>
      {currentPage === "login" && (
        <Login onChange={() => {
          setCurrentPage("Home");
          updateTeams(firestore);
        }}></Login>
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
                cursor: "pointer"
              }}
            >
              {event}
            </button>
          ))}
        </div>
      {/* )} */}

      {currentPage === "Home" && (
        <>
          <h1>All Teams</h1>
          <TeamsDisplay 
            teams={teams}
            events={events}
            onTeamClick={(team: FRCTeam) => {
              setSelectedTeam(team);
              setCurrentPage("TeamDetails");
            }}>
          </TeamsDisplay>
        </>
      )}

      {currentPage === "TeamDetails" && selectedTeam && (
        <>
          <button onClick={() => setCurrentPage("Home")}>Back</button>
          <h3>Team {selectedTeam.getTeamName()}</h3>
          <MatchLineGraph
            team = {selectedTeam}
            events = {events}>
          </MatchLineGraph>
         <div className="sidebyside">

          <ScoringPercentagePiChart 
            autoFuel={selectedTeam.getAvgAutoFuelPoints(events)}
            teleopFuel={selectedTeam.getAvgTeleopPoints(events)}
            climb={selectedTeam.getAvgClimbPoints(events)} />

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
        </>
      )}

      {currentPage === "MatchDetails" && selectedTeam && selectedMatch && (
        <>
          <button onClick={() => setCurrentPage("TeamDetails")}>Back</button>
          <h3> {selectedMatch.getEvent() + " " + selectedTeam.getTeamName() + " " + selectedMatch.getName()}</h3>

          <div className="sidebyside">

            <ScoringPercentagePiChart 
              autoFuel={selectedMatch.getAutoFuels()}
              teleopFuel={selectedMatch.getTeleopFuels()}
              climb={selectedMatch.getClimbPoints()} />

            <MatchStats match={selectedMatch}/>
          </div>
        </>
      )}
    </>
  )
}

export default App
