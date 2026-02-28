from ..models import ScoreResponseRequest, ScoreResponseResult


def score_response(req: ScoreResponseRequest) -> ScoreResponseResult:
    time_factor = 1.0
    if req.response_time_seconds < 10:
        time_factor = 1.1
    elif req.response_time_seconds > 60:
        time_factor = 0.8

    normalized = max(0.0, min(1.0, req.raw_score * time_factor))

    mastery_delta = (normalized - 0.5) * 0.1

    if normalized > 0.85:
        feedback = "Excellent work! You answered quickly and correctly."
    elif normalized > 0.6:
        feedback = "Great job! A little more practice will make you even faster."
    elif normalized > 0.4:
        feedback = "Nice try! Review this concept and try one more question."
    else:
        feedback = "This one was tricky. Let’s practice with an easier example."

    return ScoreResponseResult(
        normalized_score=normalized,
        feedback=feedback,
        mastery_delta=mastery_delta,
    )


