import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(REDIS_URL);

redis.ping((err, res) => {
  if (err) {
    console.error("Redis Ping Failed:", err);
    process.exit(1);
  } else {
    console.log("Redis Ping Success:", res);
    process.exit(0);
  }
});
