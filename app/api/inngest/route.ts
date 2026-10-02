import { serve } from "inngest/next";
import { inngest } from "@/integrations/inngest/client";
import { inngestFunctions } from "@/integrations/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
