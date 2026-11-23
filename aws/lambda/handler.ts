/**
 * AWS Lambda entry — pay-per-request via API Gateway HTTP API.
 * Uses serverless-http to run the same Express app as local dev.
 * Production deploy: main branch → Lambda OTP Deploy workflow.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2, Context } from "aws-lambda";
import express from "express";
import serverless from "serverless-http";
import storagePresign from "../../api/storage-presign";
import { asVercelHandler, createApp } from "../server/app";

type ServerlessHandler = ReturnType<typeof serverless>;

let handlerPromise: Promise<ServerlessHandler> | null = null;

// Presigning only needs the execution role. Avoid waiting for RDS schema setup
// on cold starts before the browser can begin its upload.
const presignHandler = serverless(
  express().use(express.json()).use(asVercelHandler(storagePresign))
);

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

export const handler = async (event: APIGatewayProxyEvent | APIGatewayProxyEventV2, context: Context) => {
  // Allow SMTP / HTTP clients to finish without blocking Lambda freeze
  context.callbackWaitsForEmptyEventLoop = false;
  const path = "rawPath" in event ? event.rawPath : event.path;
  const stage = event.requestContext.stage;
  if (path === "/api/storage-presign" || path === `/${stage}/api/storage-presign`) {
    return presignHandler(event, context);
  }
  try {
    const { refreshRdsIamPasswordIfNeeded } = await import("../server/db.js");
    await refreshRdsIamPasswordIfNeeded();
  } catch {
    /* DATABASE_URL / IAM optional at cold start */
  }
  const fn = await getHandler();
  return fn(event, context);
};
