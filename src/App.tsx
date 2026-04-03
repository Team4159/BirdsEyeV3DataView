import { useEffect, useState } from 'react'
import './App.css'

//firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, Firestore, onSnapshot, collection, collectionGroup } from "firebase/firestore";
import { TeamsDisplay } from './ui/TeamsDisplay';
import { FRCTeam } from './util/FRCTeam';
import { MatchData } from './util/MatchData';
import { MatchLineGraph } from './ui/MatchLineGraph';
import { ScoringPercentagePiChart } from './ui/ScoringPercentagePiChart';
import { MatchStats } from './ui/MatchStats';
import { GoogleLogin } from '@react-oauth/google';
import { logInWithGoogle } from './firebase/Auth';
import { getEvents } from './util/GetEvents';
import { getTeamsFromEvents } from './util/GetTeams';
import { MatchDataPoint } from './util/MatchDataPoint';
import { MatchDataPointStats } from './ui/MatchDataPointStats';

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
  const [selectedMatchDataPoint, setSelectedMatchDataPoint] = useState<MatchDataPoint | null>(null);

  //run when app loads
  useEffect(() => {
    const loadData = async () => {
      setEventChoices(await getEvents(firestore));
      //await updateTeams(firestore);
    };

    loadData();
  }, []);

  useEffect(() => {
    if (currentPage !== "login") {

      const unsubscribe = onSnapshot(
        collection(firestore, "events"),
        async () => {
          setEventChoices(await getEvents(firestore));
          await updateTeams(firestore);
        }
      );

      return () => unsubscribe();
    }
  }, [currentPage]); // run whenever currentPage changes

  useEffect(() => {
    updateTeams(firestore);
  }, [events]);

  useEffect(() => {

    let isUpdating = false;

    const unsubscribe = onSnapshot(
      collectionGroup(firestore, "datasets"),
      async () => {
        if (isUpdating) return;

        isUpdating = true;

        await updateTeams(firestore);

        isUpdating = false;
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  async function updateTeams(firestore: Firestore){
    const newTeams = await getTeamsFromEvents(firestore, events);

    // setEventChoices(await getEvents(firestore));
    setTeams(newTeams);

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
            autoFuel={selectedTeam.getAvgAutoFuelPoints()}
            teleopFuel={selectedTeam.getAvgTeleopPoints()}
            climb={selectedTeam.getAvgClimbPoints()} />

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
                <span>{"points: " + matchDataPoint.getPoints() + " scouter email: " + matchDataPoint.getScouterEmail()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {currentPage === "MatchDataDetails" && selectedTeam && selectedMatch && selectedMatchDataPoint && (
        <>
          <button onClick={() => setCurrentPage("MatchDetails")}>Back</button>
          <h3> {selectedMatch.getEvent() + " " + selectedTeam.getTeamName() + " " + selectedMatch.getName()}</h3>

          <div className="sidebyside">

            <ScoringPercentagePiChart 
              autoFuel={selectedMatchDataPoint.getAutoFuels()}
              teleopFuel={selectedMatchDataPoint.getTeleopFuels()}
              climb={selectedMatchDataPoint.getClimbPoints()} />

            <MatchDataPointStats matchDataPoint ={selectedMatchDataPoint}/>
          </div>
        </>
      )}
    </>
  )
}

export default App
