import { MatchData } from "./matchData";
import { compareMatchKeys } from "./matchNameUtil";
import { AUTO_FUEL_POINTS } from "./pointValues";

export class FrcTeam {
  private teamName: string;
  private matchesData: MatchData[];

  constructor(teamName: string) {
    this.teamName = teamName;
    this.matchesData = [];
  }

  getTeamName() {
    return this.teamName;
  }

  setTeamName(teamName: string) {
    this.teamName = teamName;
  }

  getAvgPoints() {
    let points = 0;
    let numMatches = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getPoints();
      numMatches++;
    });
    if (numMatches == 0) return 0;
    return points / this.matchesData.length;
  }

  getAvgAutoPoints() {
    let points = 0;
    let numMatches = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getAutoPoints();
      numMatches++;
    });
    if (numMatches == 0) return 0;
    return points / this.matchesData.length;
  }

  getAvgAutoFuelPoints() {
    let points = 0;
    let numMatches = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getAutoFuels() * AUTO_FUEL_POINTS;
      numMatches++;
    });
    if (numMatches == 0) return 0;
    return points / this.matchesData.length;
  }

  getAvgTeleopPoints() {
    let points = 0;
    let numMatches = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getTeleopPoints();
      numMatches++;
    });
    if (numMatches == 0) return 0;
    return points / this.matchesData.length;
  }

  getAvgClimbPoints() {
    let points = 0;
    let numMatches = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getClimbPoints();
      numMatches++;
    });
    if (numMatches == 0) return 0;
    return points / this.matchesData.length;
  }

  addMatch(matchData: MatchData) {
    this.matchesData.push(matchData);
    this.matchesData.sort((a, b) =>
      compareMatchKeys(a.getMatchKey(), b.getMatchKey()),
    );
  }

  getMatches(): MatchData[] {
    return this.matchesData;
  }

  getMatchNameArray(): string[] {
    const matchNameArray: string[] = [];
    this.matchesData.forEach((value, index) => {
      matchNameArray[index] = value.getName();
    });
    return matchNameArray;
  }

  getDataPoints(): number {
    let dataPoints = 0;
    for (const matchData in this.matchesData) {
      dataPoints += matchData.length;
    }
    return dataPoints;
  }
}
