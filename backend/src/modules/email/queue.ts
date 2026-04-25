import { Queue } from "bullmq";
import { connection } from "../../shared/redis";

export const emailQueue = new Queue("email-queue", { connection });

export async function addEmailToQueue(to: string, type: string, payload: any) {
  await emailQueue.add(type, { to, type, payload }, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    }
  });
}
