import type { DocumentData } from "firebase/firestore";
import { ClimbState, climbStateFromString, climbStatePoints } from "./ClimbState";
import { AUTOFUELPOINTS, FOULPOINTS, TECHFOULPOINTS, TELEOPFUELPOINTS } from "./PointsConstants";
import { formatMatchLabel } from "./MatchNameUtil";


export class MatchData{
    private matchKey: string;
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
        matchKey: string,
        autoFuels = 0,
        autoNotes = "",
        autoClimb = ClimbState.NONE,
        teleopFuels = 0,
        endgameClimb = ClimbState.NONE,
        fouls = 0,
        techFouls = 0,
        defense = false,
        driverRating = 3,
        driverNotes = "",
        scouterEmail = "",
    ){
        this.matchKey = matchKey;
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
        this.scouterEmail = scouterEmail
    }

    public getName(){
        return formatMatchLabel(this.matchKey);
    }

    public getKey(){
        return this.matchKey;
    }

    public getEvent(){
        return this.matchKey.split("_")[0];
    }

    public getAutoFuels(): number {
        return this.autoFuels;
    }

    public getAutoNotes(): string {
        return this.autoNotes;
    }

    public getAutoClimb(): ClimbState {
        return this.autoClimb;
    }

    public getTeleopFuels(): number {
        return this.teleopFuels;
    }

    public getEndgameClimb(): ClimbState {
        return this.endgameClimb;
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

    public getPoints(): number{
        return this.autoFuels * AUTOFUELPOINTS
            + climbStatePoints[this.autoClimb].points
            + this.teleopFuels * TELEOPFUELPOINTS
            + climbStatePoints[this.endgameClimb].points
            - this.fouls * FOULPOINTS
            - this.techFouls * TECHFOULPOINTS;
    }

    public getAutoPoints(): number{
        return this.autoFuels * AUTOFUELPOINTS
            + climbStatePoints[this.autoClimb].points;
    }

    public getTeleopPoints(): number{
        return this.teleopFuels * TELEOPFUELPOINTS;
    }

    public getClimbPoints(): number{
        return climbStatePoints[this.endgameClimb].points
            + climbStatePoints[this.autoClimb].points;
    }

    public getPointsNoFouls(): number{
        return climbStatePoints[this.endgameClimb].points
            + climbStatePoints[this.autoClimb].points
            + this.autoFuels * AUTOFUELPOINTS
            + this.teleopFuels * TELEOPFUELPOINTS;
    }

    public getAutoFuelPercentage(): number{
        return this.autoFuels * AUTOFUELPOINTS / this.getPointsNoFouls();
    }

    public getTeleopFuelPercentage(): number{
        return this.teleopFuels * TELEOPFUELPOINTS / this.getPointsNoFouls();
    }

    public getClimbPercentage(): number{
        return this.getClimbPoints() / this.getPointsNoFouls();
    }

    public getScouterEmail(): string{
        return this.scouterEmail
    }
}

export function MatchDataFromFirestore(data: DocumentData){
    return new MatchData(
        data.matchKey,
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
        data.email
    )
}