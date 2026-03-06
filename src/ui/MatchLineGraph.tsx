import type { FRCTeam } from "../util/FRCTeam";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { climbStatePoints } from "../util/ClimbState";
import { autoClimbBorderColor, autoClimbColor, autoFuelBorderColor, autoFuelColor, endgameClimbBorderColor, endgameClimbColor, foulBorderColor, foulColor, teleopFuelBorderColor, teleopFuelColor } from "./ColorConstants";
import { AUTOFUELPOINTS, FOULPOINTS, TECHFOULPOINTS, TELEOPFUELPOINTS } from "../util/PointsConstants";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type Props = {
  team: FRCTeam
};

export const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    title: {
      display: true,
      text: 'Matches Graph',
    },
  },
};

export const MatchLineGraph: React.FC<Props> = ({ team }) => {
  const labels = team.getMatchNameArray();

  const data = {
  labels,
  datasets: [
  {
    label: 'Total',
    data: team.getMatches().map((value) => value.getPoints()),
    borderColor: 'rgb(255,255,255)',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 3
  },
  {
    label: 'Auto Fuels',
    data: team.getMatches().map((value) => value.getAutoFuels() * AUTOFUELPOINTS),
    borderColor: autoFuelBorderColor,
    backgroundColor: autoFuelColor,
  },
  {
    label: 'Auto Climb',
    data: team.getMatches().map((value) => climbStatePoints[value.getAutoClimb()].points),
    borderColor: autoClimbBorderColor,
    backgroundColor: autoClimbColor,
  },
  {
    label: 'Teleop Fuels',
    data: team.getMatches().map((value) => value.getTeleopFuels() * TELEOPFUELPOINTS),
    borderColor: teleopFuelBorderColor,
    backgroundColor: teleopFuelColor,
  },
  {
    label: 'Endgame Climb',
    data: team.getMatches().map((value) => climbStatePoints[value.getEndgameClimb()].points),
    borderColor: endgameClimbBorderColor,
    backgroundColor: endgameClimbColor,
  },
  {
    label: 'Fouls and Tech Fouls',
    data: team.getMatches().map((value) => value.getFouls() * FOULPOINTS + value.getTechFouls() * TECHFOULPOINTS),
    borderColor: foulBorderColor,
    backgroundColor: foulColor,
  },
]
}
  return (
    <div style={{ width: "80vw", height: "500px" }}>
      <Line options={options} data={data} />
    </div>
  );
};