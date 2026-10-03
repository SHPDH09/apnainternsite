import type { IncomingMessage, ServerResponse } from "node:http";
import serverless from "serverless-http";
import { refreshRdsIamPasswordIfNeeded } from "../aws/server/db.ts";
import { createRestSurfaceApp } from "../aws/server/rest-surface-app.ts";

type ServerlessHandler = ReturnType<typeof serverless>;

let handlerPromise: Promise<ServerlessHandler> | null = null;

async function getHandler(): Promise<ServerlessHandler> {
  if (!handlerPromise) {
    handlerPromise = createRestSurfaceApp().then((app) => serverless(app));
  }
  return handlerPromise;
}

export default async function handleRestSurface(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await refreshRdsIamPasswordIfNeeded();
  const fn = await getHandler();
  await fn(req, res);
}
