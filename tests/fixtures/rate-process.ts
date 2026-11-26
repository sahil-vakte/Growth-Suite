import { rateLimited, closeRateLimitStore } from "../../src/lib/integrations/rateLimit";
async function main() {
  let allowed = 0;
  for (let i = 0; i < 12; i++) if (!(await rateLimited(process.argv[2], 8, 60_000))) allowed++;
  await closeRateLimitStore();
  console.log(JSON.stringify({ allowed }));
}
main().catch(() => process.exit(1));
