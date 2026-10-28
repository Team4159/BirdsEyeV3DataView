import type { MatchData } from "./matchData";
import { compareMatchKeys } from "./matchNameUtil";

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
    if (this.hasNoMatchData()) {
      return 0;
    }
    let points = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getPoints();
    });
    return points / this.matchesData.length;
  }

  getAvgPointsNoFouls() {
    if (this.hasNoMatchData()) {
      return 0;
    }
    let points = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getPointsNoFouls();
    });
    console.log(points / this.matchesData.length);
    return points / this.matchesData.length;
  }

  getAvgAutoPoints() {
    if (this.hasNoMatchData()) {
      return 0;
    }
    let points = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getAutoPoints();
    });
    return points / this.matchesData.length;
  }

  getAvgAutoFuelPoints() {
    if (this.hasNoMatchData()) {
      return 0;
    }
    let points = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getAutoPoints();
    });
    return points / this.matchesData.length;
  }

  getAvgTeleopPoints() {
    if (this.hasNoMatchData()) {
      return 0;
    }
    let points = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getTeleopPoints();
    });
    return points / this.matchesData.length;
  }

  getAvgClimbPoints() {
    if (this.hasNoMatchData()) {
      return 0;
    }
    let points = 0;
    this.matchesData.forEach((matchData) => {
      points += matchData.getClimbPoints();
    });
    return points / this.matchesData.length;
  }

  getAvgDriverRating() {
    if (this.hasNoMatchData()) {
      return 0;
    }
    let rating = 0;
    this.matchesData.forEach((matchData) => {
      rating += matchData.getDriverRating();
    });
    return rating / this.matchesData.length;
  }

  getAvgFouls() {
    if (this.hasNoMatchData()) {
      return 0;
    }
    let fouls = 0;
    this.matchesData.forEach((matchData) => {
      fouls += matchData.getFouls();
    });
    return fouls / this.matchesData.length;
  }

  getAvgTechFouls() {
    if (this.hasNoMatchData()) {
      return 0;
    }
    let techFouls = 0;
    this.matchesData.forEach((matchData) => {
      techFouls += matchData.getTechFouls();
    });
    return techFouls / this.matchesData.length;
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

  private hasNoMatchData(): boolean {
    return this.matchesData.length === 0;
  }
}
