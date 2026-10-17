// import Box from "@mui/material/Box";
// import { ChartsContainer } from "@mui/x-charts/ChartsContainer";
// import type { FrcTeam } from "../util/FrcTeam";
// import {
//   AUTO_FUEL_POINTS,
//   FOUL_POINTS,
//   TECH_FOUL_POINTS,
//   TELEOP_FUEL_POINTS,
// } from "../util/pointValues";
// import {
//   autoClimbBorderColor,
//   autoClimbColor,
//   autoFuelBorderColor,
//   autoFuelColor,
//   endgameClimbBorderColor,
//   endgameClimbColor,
//   foulBorderColor,
//   foulColor,
//   teleopFuelBorderColor,
//   teleopFuelColor,
//   totalPointsBorderColor,
//   totalPointsColor,
// } from "./colorConstants";
// import { BarPlot, ChartsAxisHighlight, LineHighlightPlot, LinePlot, type LineSeriesType } from "@mui/x-charts";
//
// type MatchLineGraphProps = {
//   team: FrcTeam;
// };
//
// export const MatchLineGraph = ({ team }: MatchLineGraphProps) => {
//   const labels = team.getMatchNameArray();
//
//   const data: LineSeriesType[] = [
//     {
//       type: "line",
//       yAxisId: "price",
//       color: "green",
//       label: "Total",
//       data: team.getMatches().map((value) => value.getPoints()),
//     },
//     {
//       type: "line",
//       yAxisId: "price",
//       color: "green",
//       label: "Auto Fuels",
//       data: team
//         .getMatches()
//         .map((value) => value.getAutoFuels() * AUTO_FUEL_POINTS),
//     },
//     {
//       type: "line",
//       yAxisId: "price",
//       color: "green",
//       label: "Auto Climb",
//       data: team.getMatches().map((value) => value.getAutoClimbPoints()),
//     },
//     {
//       type: "line",
//       yAxisId: "price",
//       color: "green",
//       label: "Teleop Fuels",
//       data: team
//         .getMatches()
//         .map((value) => value.getTeleopFuels() * TELEOP_FUEL_POINTS),
//     },
//     {
//       type: "line",
//       yAxisId: "price",
//       color: "green",
//       label: "Endgame Climb",
//       data: team.getMatches().map((value) => value.getEndgameClimbPoints()),
//     },
//     {
//       type: "line",
//       yAxisId: "price",
//       color: "red",
//       label: "Fouls and Tech Fouls",
//       data: team
//         .getMatches()
//         .map(
//           (value) =>
//             value.getFouls() * FOUL_POINTS +
//             value.getTechFouls() * TECH_FOUL_POINTS,
//         ),
//     },
//   ];
//   return (
//     <Box sx={{ width: "100%", height: 400 }}>
//       <ChartsContainer
//         series={data}
//         xAxis={[
//           {
//             id: "date",
//             data: team.getMatches(),
//             scaleType: "band",
//             height: 100,
//           },
//         ]}
//         yAxis={[
//           { id: "price", scaleType: "linear", position: "left", width: 50 },
//           {
//             id: "volume",
//             scaleType: "linear",
//             position: "right",
//             width: 100,
//           },
//         ]}
//       >
//         <ChartsAxisHighlight x="line" />
//         <BarPlot />
//         <LinePlot />
//
//         <LineHighlightPlot />
//       </ChartsContainer>
//     </Box>
//   );
// };
