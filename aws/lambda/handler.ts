/**
 * AWS Lambda entry — pay-per-request via API Gateway HTTP API.
 * Uses serverless-http to run the same Express app as local dev.
 * Production deploy: main branch → Lambda OTP Deploy workflow.
 */
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import serverless from "serverless-http";
import { createApp } from "../server/app";

type ServerlessHandler = ReturnType<typeof serverless>;

let handlerPromise: Promise<ServerlessHandler> | null = null;

async function getHandler(): Promise<ServerlessHandler> {
  if (!handlerPromise) {
    handlerPromise = createApp().then((app) =>
      serverless(app, {
        // API Gateway HTTP API sends base path at root
        basePath: "",
      })
    );
  }
  return handlerPromise;
}

export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
  // Allow SMTP / HTTP clients to finish without blocking Lambda freeze
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    const { refreshRdsIamPasswordIfNeeded } = await import("../server/db.js");
    await refreshRdsIamPasswordIfNeeded();
  } catch {
    /* DATABASE_URL / IAM optional at cold start */
  }
  const fn = await getHandler();
  return fn(event, context);
};
