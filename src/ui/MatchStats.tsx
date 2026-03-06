import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import type { MatchData } from '../util/MatchData';

type Props = {
  match: MatchData
};

ChartJS.register(ArcElement, Tooltip, Legend);

export const MatchStats: React.FC<Props> = ({ match }) => {

  return (
    <div className="matchStats">

        <div className="statRow">
            <span className="statLabel">Auto Fuels</span>
            <span className="statValue">{match.getAutoFuels()}</span>
        </div>

        <div className="statRow">
            <span className="statLabel">Auto Climb</span>
            <span className="statValue">{match.getAutoClimb()}</span>
        </div>

        <div className="statRow">
            <span className="statLabel">Auto Notes</span>
            <span className="statValue">{match.getAutoNotes()}</span>
        </div>

        <div className="statRow">
            <span className="statLabel">Teleop Fuels</span>
            <span className="statValue">{match.getTeleopFuels()}</span>
        </div>

        <div className="statRow">
            <span className="statLabel">Endgame Climb</span>
            <span className="statValue">{match.getEndgameClimb()}</span>
        </div>

        <div className="statRow">
            <span className="statLabel">Fouls</span>
            <span className="statValue">{match.getFouls()}</span>
        </div>

        <div className="statRow">
            <span className="statLabel">Tech Fouls</span>
            <span className="statValue">{match.getTechFouls()}</span>
        </div>

        <div className="statRow">
            <span className="statLabel">Defense</span>
            <span className="statValue">{match.getDefense() ? "Yes" : "No"}</span>
        </div>

        <div className="statRow">
            <span className="statLabel">Driver Rating</span>
            <span className="statValue">{match.getDriverRating()}/5</span>
        </div>

        <div className="statRow notes">
            <span className="statLabel">Driver Notes</span>
            <span className="statValue">{match.getDriverNotes()}</span>
        </div>

        </div>
  );
};