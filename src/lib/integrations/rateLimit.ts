import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "redis";
import { MemoryRateLimiter } from "../engines/rateLimit";

const memory = new MemoryRateLimiter();
const makeClient = () =>
  createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 2000, reconnectStrategy: false },
    disableOfflineQueue: true,
  });
let connecting: Promise<ReturnType<typeof makeClient>> | undefined;
const keyFor = (key: string) =>
  "gs:rate:" +
  createHmac("sha256", process.env.SESSION_SECRET || "local-rate-limit")
    .update(key)
    .digest("hex");
// Redis TIME avoids clock skew between app instances; the script is atomic.
const consume = `
local t = redis.call('TIME')
local now = t[1] * 1000 + math.floor(t[2] / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - tonumber(ARGV[2]))
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then return 1 end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 0
`;
async function redis() {
  if (!connecting) {
    const client = makeClient();
    client.on("error", () => {
      /* Requests fail closed; never log the credential URL. */
    });
    connecting = client
      .connect()
      .then(() => client)
      .catch((error) => {
        connecting = undefined;
        if (client.isOpen) client.destroy();
        throw error;
      });
  }
  return connecting!;
}
export async function rateLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  if (!Number.isSafeInteger(max) || max < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1)
    throw new Error("Invalid rate limit");
  const hashed = keyFor(key);
  if (!process.env.REDIS_URL) return memory.limited(hashed, max, windowMs);
  try {
    const client = await redis();
    return (
      Number(
        await client.withCommandOptions({ timeout: 2000 }).eval(consume, {
          keys: [hashed],
          arguments: [String(max), String(windowMs), randomUUID()],
        }),
      ) === 1
    );
  } catch {
    await closeRateLimitStore();
    return true;
  }
}
export async function resetRateLimit(key: string): Promise<void> {
  const hashed = keyFor(key);
  if (!process.env.REDIS_URL) {
    memory.reset(hashed);
    return;
  }
  try {
    await (await redis()).withCommandOptions({ timeout: 2000 }).del(hashed);
  } catch {
    await closeRateLimitStore();
  }
}
export async function closeRateLimitStore() {
  const pending = connecting;
  connecting = undefined;
  if (pending) {
    try {
      const client = await pending;
      if (client.isOpen) client.destroy();
    } catch {
      /* Connection already failed. */
    }
  }
}
