import { MatchData } from "./MatchData";
import { compareMatchKeys } from "./MatchNameUtil";

export class FRCTeam {
    private teamName: string;
    private matchesData: MatchData[];

    constructor(teamName: string){
        this.teamName = teamName;
        this.matchesData = [];
    }

    getTeamName(){
        return this.teamName;
    }

    setTeamName(teamName: string){
        this.teamName = teamName;
    }

    getAvgPoints(){
        var totalPoints = 0;
        this.matchesData.forEach(
            (matchData) => {
                totalPoints += matchData.getPoints();
            });
        return totalPoints / this.matchesData.length;
    }

    getAvgAutoPoints(){
        var autoPoints = 0;
        this.matchesData.forEach(
            (matchData) => {
                autoPoints += matchData.getAutoPoints();
            });
        return autoPoints / this.matchesData.length;
    }

    getAvgAutoFuelPoints(){
        var autoPoints = 0;
        this.matchesData.forEach(
            (matchData) => {
                autoPoints += matchData.getAutoFuels();
            });
        return autoPoints / this.matchesData.length;
    }

    getAvgTeleopPoints(){
        var teleopPoints = 0;
        this.matchesData.forEach(
            (matchData) => {
                teleopPoints += matchData.getTeleopPoints();
            });
        return teleopPoints / this.matchesData.length;
    }

    getAvgClimbPoints(){
        var climbPoints = 0;
        this.matchesData.forEach(
            (matchData) => {
                climbPoints += matchData.getClimbPoints();
            });
        return climbPoints / this.matchesData.length;
    }

    addMatch(matchData: MatchData){
        this.matchesData.push(matchData);
        this.matchesData.sort((a, b) => compareMatchKeys(a.getKey(), b.getKey()))
    }

    getMatches() : MatchData[]{
        return this.matchesData;
    }

    getMatchNameArray(): string[]{
        let matchNameArray: string[] = [];
        this.matchesData.forEach((value, index) => {matchNameArray[index] = value.getName()});
        return matchNameArray;
    }
}