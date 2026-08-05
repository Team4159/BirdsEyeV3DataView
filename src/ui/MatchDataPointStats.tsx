import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import type { MatchDataPoint } from "../util/matchDataPoint";

type Props = {
  matchDataPoint: MatchDataPoint;
};

ChartJS.register(ArcElement, Tooltip, Legend);

export const MatchDataPointStats: React.FC<Props> = ({ matchDataPoint }) => {
  return (
    <div className="matchStats">
      <div className="statRow">
        <span className="statLabel">Points</span>
        <span className="statValue">{matchDataPoint.getPoints()}</span>
      </div>

      <div className="statRow">
        <span className="statLabel">Auto Fuels</span>
        <span className="statValue">{matchDataPoint.getAutoFuels()}</span>
      </div>

      <div className="statRow">
        <span className="statLabel">Auto Climb</span>
        <span className="statValue">{matchDataPoint.getAutoClimbPoints()}</span>
      </div>

      <div className="statRow">
        <span className="statLabel">Auto Notes</span>
        <span className="statValue">{matchDataPoint.getAutoNotes()}</span>
      </div>

      <div className="statRow">
        <span className="statLabel">Teleop Fuels</span>
        <span className="statValue">{matchDataPoint.getTeleopFuels()}</span>
      </div>

      <div className="statRow">
        <span className="statLabel">Endgame Climb</span>
        <span className="statValue">
          {matchDataPoint.getEndgameClimbPoints()}
        </span>
      </div>

      <div className="statRow">
        <span className="statLabel">Fouls</span>
        <span className="statValue">{matchDataPoint.getFouls()}</span>
      </div>

      <div className="statRow">
        <span className="statLabel">Tech Fouls</span>
        <span className="statValue">{matchDataPoint.getTechFouls()}</span>
      </div>

      <div className="statRow">
        <span className="statLabel">Defense</span>
        <span className="statValue">
          {matchDataPoint.getDefense() ? "Yes" : "No"}
        </span>
      </div>

      <div className="statRow">
        <span className="statLabel">Driver Rating</span>
        <span className="statValue">{matchDataPoint.getDriverRating()}/5</span>
      </div>

      <div className="statRow notes">
        <span className="statLabel">Driver Notes</span>
        <span className="statValue">{matchDataPoint.getDriverNotes()}</span>
      </div>

      <div className="statRow notes">
        <span className="statLabel">Scouter Email</span>
        <span className="statValue">{matchDataPoint.getScouterEmail()}</span>
      </div>
    </div>
  );
};
