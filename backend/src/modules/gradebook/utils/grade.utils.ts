export function calculateAverage(score :number[]){
    if(!score.length) return 0;
    return score.reduce((a, b) => a + b, 0) / score.length;
}

export function calculateFinalGrade({
    assignmentAvg,
    quizAvg,
    weights

}:{
    assignmentAvg: number,
    quizAvg: number,
    weights: {
        assignment: number,
        quiz: number
    }
}){
    return (assignmentAvg * weights.assignment) + (quizAvg * weights.quiz); 
}

export function getGradeLetter(score:number){
    if(score >=80) return 'A';
    if(score >=70) return 'B';
    if(score >=60) return 'C';
    if(score >=50) return 'D';
    return 'F';
}