import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { logger } from "./shared/logger";
import { initSocket } from "./shared/socket";
import "./shared/workers";

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  logger.info("Backend listening", { event: "server_started", port: PORT });
});


