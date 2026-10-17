import type { DocumentData } from "firebase/firestore";
import {
  ClimbState,
  climbStateFromString,
  climbStatePoints,
} from "./ClimbState";
import { PointValue } from "./pointValues";

export class MatchDataPoint {
  private autoFuels: number;
  private autoNotes: string;
  private autoClimb: ClimbState;
  private teleopFuels: number;
  private endgameClimb: ClimbState;
  private fouls: number;
  private techFouls: number;
  private defense: boolean;
  private driverRating: number;
  private driverNotes: string;
  private scouterEmail: string;

  constructor(
    autoFuels = 0,
    autoNotes = "",
    autoClimb = ClimbState.None,
    teleopFuels = 0,
    endgameClimb = ClimbState.None,
    fouls = 0,
    techFouls = 0,
    defense = false,
    driverRating = 3,
    driverNotes = "",
    scouterEmail = "",
  ) {
    this.autoFuels = autoFuels;
    this.autoNotes = autoNotes;
    this.autoClimb = autoClimb;
    this.teleopFuels = teleopFuels;
    this.endgameClimb = endgameClimb;
    this.fouls = fouls;
    this.techFouls = techFouls;
    this.defense = defense;
    this.driverRating = driverRating;
    this.driverNotes = driverNotes;
    this.scouterEmail = scouterEmail;
  }

  public getAutoFuels(): number {
    return this.autoFuels;
  }

  public getAutoNotes(): string {
    return this.autoNotes;
  }

  public getAutoClimbPoints(): number {
    return climbStatePoints[this.autoClimb].points;
  }

  public getTeleopFuels(): number {
    return this.teleopFuels;
  }

  public getEndgameClimbPoints(): number {
    return climbStatePoints[this.endgameClimb].points;
  }

  public getFouls(): number {
    return this.fouls;
  }

  public getTechFouls(): number {
    return this.techFouls;
  }

  public getDefense(): boolean {
    return this.defense;
  }

  public getDriverRating(): number {
    return this.driverRating;
  }

  public getDriverNotes(): string {
    return this.driverNotes;
  }

  public getPoints(): number {
    return (
      this.autoFuels * PointValue.AutoFuelPoints +
      climbStatePoints[this.autoClimb].points +
      this.teleopFuels * PointValue.TeleopFuelPoints +
      climbStatePoints[this.endgameClimb].points -
      this.fouls * PointValue.FoulPoints -
      this.techFouls * PointValue.TechFoulPoints
    );
  }

  public getAutoPoints(): number {
    return (
      this.autoFuels * PointValue.AutoFuelPoints +
      climbStatePoints[this.autoClimb].points
    );
  }

  public getTeleopPoints(): number {
    return this.teleopFuels * PointValue.TeleopFuelPoints;
  }

  public getClimbPoints(): number {
    return (
      climbStatePoints[this.endgameClimb].points +
      climbStatePoints[this.autoClimb].points
    );
  }

  public getPointsNoFouls(): number {
    return (
      climbStatePoints[this.endgameClimb].points +
      climbStatePoints[this.autoClimb].points +
      this.autoFuels * PointValue.AutoFuelPoints +
      this.teleopFuels * PointValue.TeleopFuelPoints
    );
  }

  public getAutoFuelPercentage(): number {
    return (this.autoFuels * PointValue.AutoFuelPoints) / this.getPointsNoFouls();
  }

  public getTeleopFuelPercentage(): number {
    return (this.teleopFuels * PointValue.TeleopFuelPoints) / this.getPointsNoFouls();
  }

  public getClimbPercentage(): number {
    return this.getClimbPoints() / this.getPointsNoFouls();
  }

  public getScouterEmail(): string {
    return this.scouterEmail;
  }
}

export function matchDataPointFromFirestore(data: DocumentData) {
  return new MatchDataPoint(
    data.autoFuels,
    data.autoNotes,
    climbStateFromString(data.autoClimb),
    data.teleopFuels,
    climbStateFromString(data.endgameClimb),
    data.fouls,
    data.techFouls,
    data.defense,
    data.driverRating,
    data.driverNotes,
    data.email,
  );
}
