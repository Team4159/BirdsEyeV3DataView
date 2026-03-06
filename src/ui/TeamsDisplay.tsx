import type { FRCTeam } from "../util/FRCTeam";

let highestAVGScore = 0;
let highestAutoAVGScore = 0;
let highestTeleopAVGScore = 0;
let highestClimbAVGScore = 0;
let lowestAVGScore = Number.MAX_SAFE_INTEGER;
let lowestAutoAVGScore = Number.MAX_SAFE_INTEGER;
let lowestTeleopAVGScore = Number.MAX_SAFE_INTEGER;
let lowestClimbAVGScore = Number.MAX_SAFE_INTEGER;

type Props = {
  teams: FRCTeam[];
  events: string[];
  onTeamClick: (team: FRCTeam) => void;
};

const interpolateColor = (
  startColor: [number, number, number],
  endColor: [number, number, number],
  ratio: number // value between 0 and 1
): string => {
  const r = Math.trunc(ratio * endColor[0] + (1 - ratio) * startColor[0]);
  const g = Math.trunc(ratio * endColor[1] + (1 - ratio) * startColor[1]);
  const b = Math.trunc(ratio * endColor[2] + (1 - ratio) * startColor[2]);
  return `rgb(${r}, ${g}, ${b})`;
};

function getColor(score: number, maxScore: number, minScore: number){
  const start: [number, number, number] = [255, 0, 0]; // Red
  const end: [number, number, number] = [0, 255, 0]; // Green
  const normalizedScore = (score - minScore) / (maxScore - minScore);
  return interpolateColor(start, end, normalizedScore);
}

function calculateHighestLowestScores(teams: FRCTeam[], events: string[]){
  teams.forEach((team) => {
    const avgScore = team.getAvgPoints(events);
    const autoAVGScore = team.getAvgAutoPoints(events);
    const teleopAVGScore = team.getAvgTeleopPoints(events);
    const climbAVGScore = team.getAvgClimbPoints(events);
    
    if(avgScore > highestAVGScore) highestAVGScore = avgScore;
    if(avgScore < lowestAVGScore) lowestAVGScore = avgScore;

    if(autoAVGScore > highestAutoAVGScore) highestAutoAVGScore = autoAVGScore;
    if(autoAVGScore < lowestAutoAVGScore) lowestAutoAVGScore = autoAVGScore;

    if(teleopAVGScore > highestTeleopAVGScore) highestTeleopAVGScore = teleopAVGScore;
    if(teleopAVGScore < lowestTeleopAVGScore) lowestTeleopAVGScore = teleopAVGScore;

    if(climbAVGScore > highestClimbAVGScore) highestClimbAVGScore = climbAVGScore;
    if(climbAVGScore < lowestClimbAVGScore) lowestClimbAVGScore = climbAVGScore;
  })
}

export const TeamsDisplay: React.FC<Props> = ({ teams, events, onTeamClick}) => {
  highestAVGScore = 0;
  highestAutoAVGScore = 0;
  highestTeleopAVGScore = 0;
  highestClimbAVGScore = 0;
  lowestAVGScore = Number.MAX_SAFE_INTEGER;
  lowestAutoAVGScore = Number.MAX_SAFE_INTEGER;
  lowestTeleopAVGScore = Number.MAX_SAFE_INTEGER;
  lowestClimbAVGScore = Number.MAX_SAFE_INTEGER;
  calculateHighestLowestScores(teams, events);
  return (
    <div>
      <div
          key={"category description"} 
          className="datatable">
          <h3>{"team"}</h3>
          <h3>{"avg points"}</h3>
          <h3>{"avg auto points"}</h3>
          <h3>{"avg teleop points"}</h3>
          <h3>{"avg climb points"}</h3>
      </div>
      {
      teams.sort((a, b) => b.getAvgPoints(events) - a.getAvgPoints(events)).map((team, index) => (
        <div
            key={index} 
            className="datatable"
            onClick = {() => onTeamClick(team)}
            style={{cursor: "pointer"}}>
            <h3 >{team.getTeamName()}</h3>
            <h3 style={{color: getColor(team.getAvgPoints(events), highestAVGScore, lowestAVGScore)}}>{team.getAvgPoints(events).toFixed(2)}</h3>
            <h3 style={{color: getColor(team.getAvgAutoPoints(events), highestAutoAVGScore, lowestAutoAVGScore)}}>{team.getAvgAutoPoints(events).toFixed(2)}</h3>
            <h3 style={{color: getColor(team.getAvgTeleopPoints(events), highestTeleopAVGScore, lowestTeleopAVGScore)}}>{team.getAvgTeleopPoints(events).toFixed(2)}</h3>
            <h3 style={{color: getColor(team.getAvgClimbPoints(events), highestClimbAVGScore, lowestClimbAVGScore)}}>{team.getAvgClimbPoints(events).toFixed(2)}</h3>
        </div>
      ))}
    </div>
  );
};