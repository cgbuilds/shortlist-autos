import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { executeSearch } from "@/lib/executeSearch";
import { DEMO_COOKIE } from "@/lib/types";

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { matrix?: unknown; listings?: unknown; mode?: unknown; lat?: unknown; lng?: unknown; stream?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (body.stream === true) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        try {
          const payload = await executeSearch(body, (event) => send(event));
          send({ type: "done", ...payload });
        } catch {
          send({ type: "error", error: "Search failed." });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const payload = await executeSearch(body);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
