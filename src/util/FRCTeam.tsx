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

    getAvgPoints(events: string[]){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                if(events.includes(matchData.getEvent())){
                    points += matchData.getPoints();
                    numMatches++;
                }
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    getAvgAutoPoints(events: string[]){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                if(events.includes(matchData.getEvent())){
                    points += matchData.getAutoPoints();
                    numMatches++;
                }
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    getAvgAutoFuelPoints(events: string[]){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                if(events.includes(matchData.getEvent())){
                    points += matchData.getAutoFuels() * AUTOFUELPOINTS;
                    numMatches++;
                }
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    getAvgTeleopPoints(events: string[]){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                if(events.includes(matchData.getEvent())){
                    points += matchData.getTeleopPoints();
                    numMatches++;
                }
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    getAvgClimbPoints(events: string[]){
        var points = 0;
        var numMatches = 0;
        this.matchesData.forEach(
            (matchData) => {
                if(events.includes(matchData.getEvent())){
                    points += matchData.getClimbPoints();
                    numMatches++;
                }
            });
        if(numMatches == 0) return 0;
        return points / this.matchesData.length;
    }

    addMatch(matchData: MatchData){
        this.matchesData.push(matchData);
        this.matchesData.sort((a, b) => compareMatchKeys(a.getKey(), b.getKey()))
    }

    getMatches() : MatchData[]{
        return this.matchesData;
    }

    getMatchesEventsFilter(events: string[]) : MatchData[]{
        let filteredMatches: MatchData[] = [];
        this.matchesData.forEach((match) => {
            if(events.includes(match.getEvent())){
                filteredMatches.push(match);
            }
        })
        return filteredMatches;
    }

    getMatchNameArray(): string[]{
        let matchNameArray: string[] = [];
        this.matchesData.forEach((value, index) => {matchNameArray[index] = value.getName()});
        return matchNameArray;
    }

    getMatchNameArrayEventsFilter(events: string[]): string[] {
        return this.matchesData
            .filter(match => events.includes(match.getEvent()))
            .map(match => match.getEvent() + " " + match.getName());
    }
}