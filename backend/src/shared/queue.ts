import { Queue, Worker, Job } from "bullmq";
import { connection } from "./redis";

/**
 * Shared BullMQ configuration and helpers
 */
export const createQueue = (name: string) => {
  return new Queue(name, { connection });
};

export const createWorker = (name: string, processor: (job: Job) => Promise<any>) => {
  return new Worker(name, processor, { connection });
};
