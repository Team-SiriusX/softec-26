import { createRouteHandler } from "uploadthing/next";
import { NextRequest, NextResponse } from "next/server";

import { ourFileRouter } from "./core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let uploadthingRouteHandler: ReturnType<typeof createRouteHandler> | null = null;

function normalizeUploadthingToken(rawToken: string) {
  return rawToken.trim().replace(/^['\"]|['\"]$/g, '');
}

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
  const token = process.env.UPLOADTHING_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        error:
          "UploadThing is not configured. Set UPLOADTHING_TOKEN in your environment and restart the server.",
      },
      { status: 503 },
    );
  }

  const normalizedToken = normalizeUploadthingToken(token);

  if (!normalizedToken) {
    return NextResponse.json(
      {
        error:
          "UploadThing token is empty after normalization. Check UPLOADTHING_TOKEN formatting.",
      },
      { status: 503 },
    );
  }

  if (normalizedToken !== token) {
    process.env.UPLOADTHING_TOKEN = normalizedToken;
  }

  try {
    JSON.parse(Buffer.from(normalizedToken, 'base64').toString('utf8'));
    return null;
  } catch {
    return NextResponse.json(
      {
        error:
          "UPLOADTHING_TOKEN appears invalid (not base64 JSON). Regenerate your token and restart the server.",
      },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest) {
  const configError = ensureUploadthingConfigured();
  if (configError) {
    return configError;
  }

  try {
    const handler = getUploadthingRouteHandler();
    return handler.GET(request);
  } catch (error) {
    console.error('UploadThing GET route failed', error);

    return NextResponse.json(
      {
        error: 'UploadThing GET route failed',
        detail:
          process.env.NODE_ENV !== 'production' && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const configError = ensureUploadthingConfigured();
  if (configError) {
    return configError;
  }

  try {
    const handler = getUploadthingRouteHandler();
    return handler.POST(request);
  } catch (error) {
    console.error('UploadThing POST route failed', error);

    return NextResponse.json(
      {
        error: 'UploadThing POST route failed',
        detail:
          process.env.NODE_ENV !== 'production' && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 },
    );
  }
}
