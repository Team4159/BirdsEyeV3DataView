import type { MatchDataPoint } from "./matchDataPoint";
import { formatMatchLabel } from "./matchNameUtil";
import {
  AUTOFUELPOINTS,
  FOULPOINTS,
  TECHFOULPOINTS,
  TELEOPFUELPOINTS,
} from "./pointValues";

export class MatchData {
  //different data points for the same match that then get avged
  private dataPoints: MatchDataPoint[];
  private matchKey: string;

  constructor(dataPoints: MatchDataPoint[], matchKey: string) {
    this.dataPoints = dataPoints;
    this.matchKey = matchKey;
  }

  public addDataPoint(dataPoint: MatchDataPoint) {
    this.dataPoints.push(dataPoint);
  }

  public getAutoFuels(): number {
    let autoFuels = 0;
    for (let i = 0; i < this.dataPoints.length; i++) {
      autoFuels += this.dataPoints[i].getAutoFuels();
    }
    return autoFuels / this.dataPoints.length;
  }

  public getAutoClimbPoints(): number {
    let autoClimbPoints = 0;
    for (let i = 0; i < this.dataPoints.length; i++) {
      autoClimbPoints += this.dataPoints[i].getAutoClimbPoints();
    }
    return autoClimbPoints / this.dataPoints.length;
  }

  public getTeleopFuels(): number {
    let teleopFuels = 0;
    for (let i = 0; i < this.dataPoints.length; i++) {
      teleopFuels += this.dataPoints[i].getTeleopFuels();
    }
    return teleopFuels / this.dataPoints.length;
  }

  public getEndgameClimbPoints(): number {
    let endgameClimbPoints = 0;
    for (let i = 0; i < this.dataPoints.length; i++) {
      endgameClimbPoints += this.dataPoints[i].getEndgameClimbPoints();
    }
    return endgameClimbPoints / this.dataPoints.length;
  }

  public getFouls(): number {
    let fouls = 0;
    for (let i = 0; i < this.dataPoints.length; i++) {
      fouls += this.dataPoints[i].getFouls();
    }
    return fouls / this.dataPoints.length;
  }

  public getTechFouls(): number {
    let techFouls = 0;
    for (let i = 0; i < this.dataPoints.length; i++) {
      techFouls += this.dataPoints[i].getTechFouls();
    }
    return techFouls / this.dataPoints.length;
  }

  public getDefense(): boolean {
    let defenseCounter = 0;
    for (let i = 0; i < this.dataPoints.length; i++) {
      if (this.dataPoints[i].getDefense()) defenseCounter++;
    }
    return defenseCounter / this.dataPoints.length > 0.5;
  }

  public getDriverRating(): number {
    let driverRating = 0;
    for (let i = 0; i < this.dataPoints.length; i++) {
      driverRating += this.dataPoints[i].getDriverRating();
    }
    return driverRating / this.dataPoints.length;
  }

  public getPoints(): number {
    return (
      this.getAutoFuels() * AUTOFUELPOINTS +
      this.getAutoClimbPoints() +
      this.getTeleopFuels() * TELEOPFUELPOINTS +
      this.getEndgameClimbPoints() -
      this.getFouls() * FOULPOINTS -
      this.getTechFouls() * TECHFOULPOINTS
    );
  }

  public getAutoPoints(): number {
    return this.getAutoFuels() * AUTOFUELPOINTS + this.getAutoClimbPoints();
  }

  public getTeleopPoints(): number {
    return this.getTeleopFuels() * TELEOPFUELPOINTS;
  }

  public getClimbPoints(): number {
    return this.getEndgameClimbPoints() + this.getAutoClimbPoints();
  }

  public getPointsNoFouls(): number {
    return (
      this.getAutoClimbPoints() +
      this.getEndgameClimbPoints() +
      this.getAutoFuels() * AUTOFUELPOINTS +
      this.getTeleopFuels() * TELEOPFUELPOINTS
    );
  }

  public getAutoFuelPercentage(): number {
    return (this.getAutoFuels() * AUTOFUELPOINTS) / this.getPointsNoFouls();
  }

  public getTeleopFuelPercentage(): number {
    return (this.getTeleopFuels() * TELEOPFUELPOINTS) / this.getPointsNoFouls();
  }

  public getClimbPercentage(): number {
    return this.getClimbPoints() / this.getPointsNoFouls();
  }

  public getMatchKey(): string {
    return this.matchKey;
  }

  public getName() {
    return formatMatchLabel(this.matchKey);
  }

  public getEvent() {
    return this.matchKey.split("_")[0];
  }

  public getMatchDataPoints() {
    return this.dataPoints;
  }
}
