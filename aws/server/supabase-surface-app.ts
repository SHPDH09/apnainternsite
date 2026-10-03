/**
 * Minimal Express app for Vercel: GoTrue + PostgREST + storage only (Hyderabad RDS).
 * Avoids importing the full Lambda API surface from app.ts (Vercel bundle size).
 */
import express, { type Express } from "express";
import {
  authLogout,
  authSettings,
  authSignup,
  authToken,
  authUser,
} from "./local-auth.js";
import {
  restDelete,
  restGet,
  restPatch,
  restPost,
  restRpc,
} from "./local-rest.js";
import { handleStorageRequest, storageRawBody } from "./s3-storage.js";

let appPromise: Promise<Express> | null = null;

export function createSupabaseSurfaceApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = build();
  }
  return appPromise;
}

async function build(): Promise<Express> {
  const app = express();
  app.use(storageRawBody);
  app.use(express.json({ limit: "2mb" }));

  for (const prefix of ["/staging", "/production"]) {
    app.use((req, _res, next) => {
      if (req.url === prefix) {
        req.url = "/";
      } else if (req.url.startsWith(`${prefix}/`)) {
        req.url = req.url.slice(prefix.length) || "/";
      }
      next();
    });
  }

  app.use((req, res, next) => {
    const origin = String(req.headers.origin || "").trim();
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST,PUT,PATCH,DELETE,HEAD");
    const requested = String(req.headers["access-control-request-headers"] || "").trim();
    res.setHeader(
      "Access-Control-Allow-Headers",
      requested ||
        "Authorization, Content-Type, apikey, Prefer, X-Client-Info, X-Supabase-Api-Version, X-Requested-With, Accept"
    );
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get("/auth/v1/settings", authSettings);
  app.get("/auth/v1/health", (_req, res) => res.json({ version: "local", name: "GoTrue" }));
  app.post("/auth/v1/token", authToken);
  app.get("/auth/v1/user", authUser);
  app.post("/auth/v1/logout", authLogout);
  app.post("/auth/v1/signup", authSignup);

  app.get("/rest/v1/:table", restGet);
  app.head("/rest/v1/:table", restGet);
  app.post("/rest/v1/:table", restPost);
  app.patch("/rest/v1/:table", restPatch);
  app.delete("/rest/v1/:table", restDelete);
  app.post("/rest/v1/rpc/:name", restRpc);

  app.all("/storage/v1/*", handleStorageRequest);
  app.get("/realtime/v1/*", (_req, res) => res.status(501).end());

  return app;
}
