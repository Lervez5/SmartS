import { Server as SocketIOServer } from "socket.io";
import { Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { logger } from "./logger";
import { config } from "../config";

export let io: SocketIOServer;

export const initSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.cors.origins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    logger.info("New client connected", { event: "socket_connect", socketId: socket.id });

    socket.on("disconnect", () => {
      logger.info("Client disconnected", { event: "socket_disconnect", socketId: socket.id });
    });
  });

  return io;
};
