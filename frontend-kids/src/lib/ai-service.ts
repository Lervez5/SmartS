const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || "http://localhost:5000";

export interface GamificationProfile {
    student_id: string;
    xp: number;
    level: number;
    badges: { code: string; name: string; awarded_at: string }[];
}

export async function getGamificationProfile(studentId: string): Promise<GamificationProfile> {
    try {
        const res = await fetch(`${AI_ENGINE_URL}/gamification/profile/${studentId}`);
        if (!res.ok) throw new Error("Failed to fetch profile");
        return await res.json();
    } catch (error) {
        console.error("AI Engine Error:", error);
        return { student_id: studentId, xp: 0, level: 1, badges: [] };
    }
}

export async function processGamificationEvent(studentId: string, eventType: string, payload: any) {
    try {
        const res = await fetch(`${AI_ENGINE_URL}/gamification/process-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                student_id: studentId,
                event_type: eventType,
                payload
            })
        });
        return await res.json();
    } catch (error) {
        console.error("AI Engine Event Error:", error);
        return null;
    }
}
