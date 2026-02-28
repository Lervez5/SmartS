import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { logger } from "./shared/logger";

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info({ event: "server_started", port: PORT }, "Backend listening");
});


