import express, { type Express } from "express";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { createDeliveryWebhook } from "./lib/email-worker/delivery";
import { saveDeliveryEvent } from "./lib/email-worker/delivery-postgres";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
// Machine-only endpoint: verified raw bytes before JSON parsing and browser authentication.
app.post("/api/webhooks/resend", express.raw({ type: "application/json", limit: "256kb" }), createDeliveryWebhook(saveDeliveryEvent));
// Preserve exact signed bytes; only the Meta webhook bypasses JSON parsing.
app.use("/api/guard/notifications/webhook", express.raw({ type: "application/json", limit: "256kb" }));
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware(req => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
})));

app.use("/api", router);

export default app;
