const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let ioRef = null;

function initRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("Unauthorized"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const sub = socket.user?.sub;
    if (sub) socket.join(`user:${sub}`);
    if (socket.user?.role === "admin") socket.join("admins");
  });

  ioRef = io;
  return io;
}

function emitToUser(userId, event, payload) {
  if (!ioRef || !userId) return;
  ioRef.to(`user:${String(userId)}`).emit(event, payload);
}

function emitToAdmins(event, payload) {
  if (!ioRef) return;
  ioRef.to("admins").emit(event, payload);
}

module.exports = { initRealtime, emitToUser, emitToAdmins };
