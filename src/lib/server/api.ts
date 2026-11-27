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
      // Validate Origin and fail closed when browser request metadata is absent.
      // Bearer-only device requests do not rely on ambient cookies and are not CSRF-prone.
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        const site = req.headers.get("sec-fetch-site");
        const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host")].filter((host): host is string => !!host);
        const bearerOnly = /^Bearer\s+\S+$/i.test(req.headers.get("authorization") ?? "") && !req.cookies.get("lifeos_session");
        if (!bearerOnly) {
          if (site === "cross-site") throw new ApiError(403, "Cross-origin request blocked.");
          if (origin) {
            let originHost = "";
            try {
              const parsed = new URL(origin);
              if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Invalid origin protocol");
              originHost = parsed.host;
            } catch {
              throw new ApiError(403, "Cross-origin request blocked.");
            }
            if (!hosts.includes(originHost)) throw new ApiError(403, "Cross-origin request blocked.");
          } else if (site !== "same-origin" && site !== "none") {
            throw new ApiError(403, "Cross-origin request blocked.");
          }
        }
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

const MAX_API_BODY_BYTES = 1_000_000;

export async function body<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_API_BODY_BYTES) {
    throw new ApiError(413, "Request body is too large.");
  }

  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "Invalid JSON body.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_API_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "Request body is too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return schema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof ZodError) throw error;
    throw new ApiError(400, "Invalid JSON body.");
  }
}

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
export function uuidParam(s: string) {
  if (!isUuid(s)) throw new ApiError(404, "Not found.");
  return s;
}
