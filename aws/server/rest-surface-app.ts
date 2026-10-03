/**
 * Minimal PostgREST shim for Vercel (Supabase Postgres via pooler).
 * Smaller cold start than full auth/storage surface.
 */
import express, { type Express } from "express";
import { restDelete, restGet, restPatch, restPost, restRpc } from "./local-rest.js";

let appPromise: Promise<Express> | null = null;

export function createRestSurfaceApp(): Promise<Express> {
  if (!appPromise) appPromise = build();
  return appPromise;
}

async function build(): Promise<Express> {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

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

  app.get("/rest/v1/:table", restGet);
  app.head("/rest/v1/:table", restGet);
  app.post("/rest/v1/:table", restPost);
  app.patch("/rest/v1/:table", restPatch);
  app.delete("/rest/v1/:table", restDelete);
  app.post("/rest/v1/rpc/:name", restRpc);

  return app;
}
