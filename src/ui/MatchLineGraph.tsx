import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { FrcTeam } from "../util/FrcTeam";
import {
  AUTO_FUEL_POINTS,
  FOUL_POINTS,
  TECH_FOUL_POINTS,
  TELEOP_FUEL_POINTS,
} from "../util/pointValues";
import {
  autoClimbBorderColor,
  autoClimbColor,
  autoFuelBorderColor,
  autoFuelColor,
  endgameClimbBorderColor,
  endgameClimbColor,
  foulBorderColor,
  foulColor,
  teleopFuelBorderColor,
  teleopFuelColor,
  totalPointsBorderColor,
  totalPointsColor,
} from "./colorConstants";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

type MatchLineGraphProps = {
  team: FrcTeam;
  events: string[];
};

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top" as const,
    },
    title: {
      display: true,
      text: "Matches Graph",
    },
  },
};

export const MatchLineGraph = ({ team }: MatchLineGraphProps) => {
  const labels = team.getMatchNameArray();

  const data = {
    labels,
    datasets: [
      {
        label: "Total",
        data: team.getMatches().map((value) => value.getPoints()),
        borderColor: totalPointsBorderColor,
        backgroundColor: totalPointsColor,
      },
      {
        label: "Auto Fuels",
        data: team
          .getMatches()
          .map((value) => value.getAutoFuels() * AUTO_FUEL_POINTS),
        borderColor: autoFuelBorderColor,
        backgroundColor: autoFuelColor,
      },
      {
        label: "Auto Climb",
        data: team.getMatches().map((value) => value.getAutoClimbPoints()),
        borderColor: autoClimbBorderColor,
        backgroundColor: autoClimbColor,
      },
      {
        label: "Teleop Fuels",
        data: team
          .getMatches()
          .map((value) => value.getTeleopFuels() * TELEOP_FUEL_POINTS),
        borderColor: teleopFuelBorderColor,
        backgroundColor: teleopFuelColor,
      },
      {
        label: "Endgame Climb",
        data: team.getMatches().map((value) => value.getEndgameClimbPoints()),
        borderColor: endgameClimbBorderColor,
        backgroundColor: endgameClimbColor,
      },
      {
        label: "Fouls and Tech Fouls",
        data: team
          .getMatches()
          .map(
            (value) =>
              value.getFouls() * FOUL_POINTS +
              value.getTechFouls() * TECH_FOUL_POINTS,
          ),
        borderColor: foulBorderColor,
        backgroundColor: foulColor,
      },
    ],
  };
  return (
    <div
      style={{
        width: "80vw",
        height: "500px",
        position: "relative",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <Line options={options} data={data} />
    </div>
  );
};
