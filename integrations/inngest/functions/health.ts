import { inngest } from "../client";

export const healthPing = inngest.createFunction(
  {
    id: "health-ping",
    triggers: [{ event: "voxa/health.ping" }],
  },
  async () => ({
    ok: true,
    at: new Date().toISOString(),
  }),
);
