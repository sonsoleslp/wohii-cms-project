const app = require("./app");
const logger = require("./lib/logger");
const prisma = require("./lib/prisma");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "server listening");
});

async function shutdown(signal) {
  logger.info({ signal }, "shutting down");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
