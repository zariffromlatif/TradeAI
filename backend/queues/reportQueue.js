const Bull = require("bull");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const reportQueue = new Bull("report-generation", redisUrl);

function enqueueReportJob(reportJobId) {
  return reportQueue.add(
    { reportJobId: String(reportJobId) },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  );
}

async function cancelQueueJob(queueJobId) {
  if (!queueJobId) return false;
  const job = await reportQueue.getJob(String(queueJobId));
  if (!job) return false;
  const state = await job.getState();
  if (state === "active" || state === "completed" || state === "failed") return false;
  await job.remove();
  return true;
}

module.exports = { reportQueue, enqueueReportJob, cancelQueueJob };
