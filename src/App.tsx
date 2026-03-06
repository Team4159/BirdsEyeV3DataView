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
  const [currentPage, setCurrentPage] = useState("Home");
  const [teams, setTeams] = useState([new FRCTeam("temp")]);
  const [selectedTeam, setSelectedTeam] = useState<FRCTeam | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);

  //run when app loads
  useEffect(() => {
    updateTeams(firestore);
  }, []);

  useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(firestore, "matches"), 
    async () => {
      const teams = await getTeams(firestore);
      setTeams(teams);
    }
  );

  return () => unsubscribe(); // cleanup when component unmounts
}, []);

  async function updateTeams(firestore: Firestore){
    const teams = await getTeams(firestore);
    setTeams(teams);
  }

  return (
    <>
      {currentPage === "Home" && (
        <>
          <h1>All Teams</h1>
          <TeamsDisplay 
            teams={teams}
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
            team = {selectedTeam}>
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
                <span>{match.getName()}</span>
              </div>
            ))}
          </div>

        </div>
        </>
      )}

      {currentPage === "MatchDetails" && selectedTeam && selectedMatch && (
        <>
          <button onClick={() => setCurrentPage("TeamDetails")}>Back</button>
          <h3> {selectedTeam.getTeamName() + " " + selectedMatch.getName()}</h3>

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
