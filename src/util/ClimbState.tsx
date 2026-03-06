export enum ClimbState {
    NONE = "none",
    L1Auto = "l1auto",
    L1 = "l1",
    L2 = "l2",
    L3 = "l3"
}

// Define the color mapping for each state (make sure this matches what you're expecting)
export const climbStatePoints = {
    [ClimbState.NONE] : {points: 0},
    [ClimbState.L1Auto] : {points: 15},
    [ClimbState.L1] : {points: 10},
    [ClimbState.L2] : {points: 20},
    [ClimbState.L3] : {points: 30}
};

export function climbStateFromString(text: string): ClimbState{
    switch(text){
        case "l1auto": return ClimbState.L1Auto;
        case "l1": return ClimbState.L1;
        case "l2": return ClimbState.L2;
        case "l3": return ClimbState.L3;
        default: return ClimbState.NONE;
    }
}