import { MatchData } from "./MatchData";
import { compareMatchKeys } from "./MatchNameUtil";
import { AUTOFUELPOINTS } from "./PointsConstants";

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
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                points += matchData.getPoints();
                numMatches++;
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    getAvgAutoPoints(){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                points += matchData.getAutoPoints();
                numMatches++;
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    getAvgAutoFuelPoints(){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                points += matchData.getAutoFuels() * AUTOFUELPOINTS;
                numMatches++;
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    getAvgTeleopPoints(){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                points += matchData.getTeleopPoints();
                numMatches++;
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    getAvgClimbPoints(){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                points += matchData.getClimbPoints();
                numMatches++;
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    addMatch(matchData: MatchData){
        this.matchesData.push(matchData);
        this.matchesData.sort((a, b) => compareMatchKeys(a.getMatchKey(), b.getMatchKey()))
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