import app from "./app";
import { logger } from "./lib/logger";
import { processScheduledCampaigns } from "./routes/campaigns";
import { processSequencesDue } from "./routes/sequences";
import { processWarmupSchedules } from "./routes/warmup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  setInterval(async () => {
    await processScheduledCampaigns().catch(() => {});
  }, 60 * 1000);

  setInterval(async () => {
    await processSequencesDue().catch(() => {});
  }, 5 * 60 * 1000);

  setInterval(async () => {
    await processWarmupSchedules().catch(() => {});
  }, 60 * 60 * 1000);
});
