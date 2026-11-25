import { NextRequest } from "next/server";
import { z, ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

type Fn<P> = (req: NextRequest, params: P) => Promise<unknown>;

export function handle<P = Record<string, never>>(fn: Fn<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      // CSRF defence for cookie-authenticated mutations: same-origin only
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        const site = req.headers.get("sec-fetch-site");
        const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host")].filter(Boolean);
        const sameOrigin = site === "same-origin" || site === "none";
        if (!sameOrigin && origin && hosts.length && !hosts.includes(new URL(origin).host)) throw new ApiError(403, "Cross-origin request blocked.");
        if (site === "cross-site") throw new ApiError(403, "Cross-origin request blocked.");
      }
      const params = (ctx?.params ? await ctx.params : {}) as P;
      const r = await fn(req, params);
      if (r instanceof Response) return r;
      return Response.json(r ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof ZodError) {
        const i = e.issues[0];
        return Response.json({ error: `${i?.path.join(".") || "input"}: ${i?.message ?? "invalid"}` }, { status: 400 });
      }
      console.error("[api]", e);
      return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function body<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
  return schema.parse(json);
}

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
export function uuidParam(s: string) {
  if (!isUuid(s)) throw new ApiError(404, "Not found.");
  return s;
}
