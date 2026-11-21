/** Central configuration. Every third-party integration falls back to MOCK mode when its keys are missing,
 * so the platform runs end-to-end without credentials. See .env.example and docs/INTEGRATIONS.pdf. */
const e = (k: string, d = "") => process.env[k] ?? d;

export const env = {
  appName: e("APP_NAME", "Growth Suite"),
  appUrl: e("APP_URL", "http://localhost:3000"),
  nodeEnv: e("NODE_ENV", "development"),
  sessionSecret: e("SESSION_SECRET", "dev-only-session-secret-change-me-32chars!!"),
  encryptionKey: e("ENCRYPTION_KEY"), // 32-byte base64 for AES-256-GCM
  cronSecret: e("CRON_SECRET", "dev-cron-secret"),
  defaultSiteDomain: e("DEFAULT_SITE_DOMAIN", "localhost"),
  forceMock: e("INTEGRATIONS_MODE", "auto") === "mock",
  storageDir: e("STORAGE_DIR", "./storage"),
  publicUploadsBase: e("PUBLIC_UPLOADS_BASE", "/uploads"),
  licencePublicKey: e("LICENCE_PUBLIC_KEY"),
  licencePrivateKey: e("LICENCE_PRIVATE_KEY"),

  whatsapp: {
    token: e("WHATSAPP_ACCESS_TOKEN"),
    appSecret: e("META_APP_SECRET"),
    verifyToken: e("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    graphVersion: e("META_GRAPH_VERSION", "v21.0"),
    partnerBusinessId: e("META_PARTNER_BUSINESS_ID"),
  },
  meta: {
    appId: e("META_APP_ID"),
    appSecret: e("META_APP_SECRET"),
    systemUserToken: e("META_SYSTEM_USER_TOKEN"),
    leadsVerifyToken: e("META_LEADS_WEBHOOK_VERIFY_TOKEN"),
  },
  openai: {
    apiKey: e("OPENAI_API_KEY"),
    model: e("OPENAI_MODEL", "gpt-4.1-mini"),
    embeddingModel: e("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
  },
  anthropic: { apiKey: e("ANTHROPIC_API_KEY"), model: e("ANTHROPIC_MODEL", "claude-sonnet-4-5") },
  razorpay: {
    keyId: e("RAZORPAY_KEY_ID"),
    keySecret: e("RAZORPAY_KEY_SECRET"),
    webhookSecret: e("RAZORPAY_WEBHOOK_SECRET"),
  },
  stripe: { secretKey: e("STRIPE_SECRET_KEY"), webhookSecret: e("STRIPE_WEBHOOK_SECRET") },
  smtp: {
    host: e("SMTP_HOST"),
    port: Number(e("SMTP_PORT", "587")),
    user: e("SMTP_USER"),
    pass: e("SMTP_PASS"),
    from: e("SMTP_FROM", "Growth Suite <no-reply@example.com>"),
  },
  google: {
    clientId: e("GOOGLE_CLIENT_ID"),
    clientSecret: e("GOOGLE_CLIENT_SECRET"),
    serviceAccountJson: e("GOOGLE_SERVICE_ACCOUNT_JSON"),
  },
  search: { serperApiKey: e("SERPER_API_KEY") },
  video: { dailyApiKey: e("DAILY_API_KEY") },
  s3: {
    bucket: e("S3_BUCKET"),
    region: e("S3_REGION"),
    endpoint: e("S3_ENDPOINT"),
    accessKeyId: e("S3_ACCESS_KEY_ID"),
    secretAccessKey: e("S3_SECRET_ACCESS_KEY"),
    publicBaseUrl: e("S3_PUBLIC_BASE_URL"),
  },
};

export const isConfigured = {
  whatsapp: () => !env.forceMock && !!env.whatsapp.token,
  meta: () => !env.forceMock && !!env.meta.systemUserToken,
  openai: () => !env.forceMock && !!env.openai.apiKey,
  anthropic: () => !env.forceMock && !!env.anthropic.apiKey,
  razorpay: () => !env.forceMock && !!env.razorpay.keyId && !!env.razorpay.keySecret,
  stripe: () => !env.forceMock && !!env.stripe.secretKey,
  smtp: () => !env.forceMock && !!env.smtp.host,
  search: () => !env.forceMock && !!env.search.serperApiKey,
  video: () => !env.forceMock && !!env.video.dailyApiKey,
  googleCalendar: () => !env.forceMock && !!env.google.serviceAccountJson,
};
