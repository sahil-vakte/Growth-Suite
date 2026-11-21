import { withApiLog } from "@/lib/apiLogging";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { tick } from "@/lib/jobs";

/** Call every minute from a scheduler (Vercel Cron, GitHub Actions, cron-job.org, Kubernetes CronJob) with
 *  Authorization: Bearer <CRON_SECRET>. Alternatively run `npm run worker` as a long-running process. */
async function handlePOST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${env.cronSecret}`))
    return new Response("Unauthorised", { status: 401 });
  return Response.json(await tick());
}
export const GET = withApiLog("/api/cron/tick", "GET", handlePOST);

export const POST = withApiLog("/api/cron/tick", "POST", handlePOST);
