import { createRouteHandler } from "uploadthing/next";
import { NextRequest, NextResponse } from "next/server";

import { ourFileRouter } from "./core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let uploadthingRouteHandler: ReturnType<typeof createRouteHandler> | null = null;

function getUploadthingRouteHandler() {
  if (uploadthingRouteHandler) {
    return uploadthingRouteHandler;
  }

  uploadthingRouteHandler = createRouteHandler({
    router: ourFileRouter,

    // Apply an (optional) custom config:
    // config: { ... },
  });

  return uploadthingRouteHandler;
}

function ensureUploadthingConfigured() {
  if (process.env.UPLOADTHING_TOKEN) {
    return null;
  }

  return NextResponse.json(
    {
      error:
        "UploadThing is not configured. Set UPLOADTHING_TOKEN in your environment and restart the server.",
    },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  const configError = ensureUploadthingConfigured();
  if (configError) {
    return configError;
  }

  const handler = getUploadthingRouteHandler();
  return handler.GET(request);
}

export async function POST(request: NextRequest) {
  const configError = ensureUploadthingConfigured();
  if (configError) {
    return configError;
  }

  const handler = getUploadthingRouteHandler();
  return handler.POST(request);
}
