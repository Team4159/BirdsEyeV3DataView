import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { autoFuelBorderColor, autoFuelColor, endgameClimbBorderColor, endgameClimbColor, teleopFuelBorderColor, teleopFuelColor } from './ColorConstants';

type Props = {
  autoFuel: number;
  teleopFuel: number;
  climb: number;
};

ChartJS.register(ArcElement, Tooltip, Legend);

export const ScoringPercentagePiChart: React.FC<Props> = ({ autoFuel, teleopFuel, climb }) => {
    const data = {
    labels: ['Auto Fuels', 'Teleop Fuels', 'Climb (Auto + Endgame)'],
    datasets: [
        {
        label: '# of Votes',
        data: [autoFuel, teleopFuel, climb],
        backgroundColor: [
            autoFuelColor,
            teleopFuelColor,
            endgameClimbColor,
        ],
        borderColor: [
            autoFuelBorderColor,
            teleopFuelBorderColor,
            endgameClimbBorderColor,
        ],
        borderWidth: 1,
        },
    ],
  }

  return (
    <div style={{ width: "50vw", height: "500px" }}>
      <Pie data={data} />
    </div>
  );
};