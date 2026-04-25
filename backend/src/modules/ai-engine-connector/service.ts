import axios from "axios";
import { ApiError } from "../../shared/errorHandler";
import { aiQueue } from "../../shared/queues";

const AI_BASE_URL = process.env.AI_ENGINE_URL || "http://ai_engine:5000";

export async function predictSkill(payload: unknown) {
  try {
    const res = await axios.post(`${AI_BASE_URL}/predict-skill/`, payload, {
      timeout: 3000,
    });
    return res.data;
  } catch (err) {
    throw new ApiError(502, "AI engine unavailable", err);
  }
}

export async function recommendNext(payload: unknown) {
  try {
    const res = await axios.post(`${AI_BASE_URL}/recommend-next/`, payload, {
      timeout: 3000,
    });
    return res.data;
  } catch (err) {
    throw new ApiError(502, "AI engine unavailable", err);
  }
}

export async function scoreResponseAi(payload: unknown) {
  try {
    const res = await axios.post(`${AI_BASE_URL}/score-response/`, payload, {
      timeout: 3000,
    });
    return res.data;
  } catch (err) {
    throw new ApiError(502, "AI engine unavailable", err);
  }
}

export async function generateContentAsync(payload: unknown) {
  try {
    const job = await aiQueue.add('generate-content', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    return { jobId: job.id, status: 'queued' };
  } catch (err) {
    throw new ApiError(500, "Failed to queue AI job", err);
  }
}


