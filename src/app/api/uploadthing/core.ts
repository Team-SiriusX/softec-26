import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

const f = createUploadthing();

function isWorkerRole(role: unknown): boolean {
  if (typeof role !== "string") {
    return false;
  }

  return role.trim().toUpperCase() === "WORKER";
}

async function resolveSessionRole(user: { id: string; role?: unknown }) {
  if (typeof user.role === "string" && user.role.trim().length > 0) {
    return user.role.trim().toUpperCase();
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  return dbUser?.role ?? null;
}

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  screenshotUploader: f({
    image: {
      /**
       * For full list of options and defaults, see the File Route API reference
       * @see https://docs.uploadthing.com/file-routes#route-config
       */
      maxFileSize: "8MB",
      maxFileCount: 6,
    },
  })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      // This code runs on your server before upload
      const session = await auth.api.getSession({
        headers: req.headers,
      });
      const user = session?.user;

      // If you throw, the user will not be able to upload
      if (!user) throw new UploadThingError("Unauthorized");

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return {
        userId: user.id,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileUrl = file.ufsUrl ?? (file as { url?: string }).url;

      if (!fileUrl) {
        throw new UploadThingError("Upload completed but no file URL was returned");
      }

      // This code RUNS ON YOUR SERVER after upload
      console.log("Upload complete for userId:", metadata.userId);

      console.log("file url", fileUrl);

      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return {
        uploadedBy: metadata.userId,
        fileUrl,
        fileKey: file.key,
      };
    }),
  communityPostMediaUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 8,
    },
    video: {
      maxFileSize: "64MB",
      maxFileCount: 2,
    },
  })
    .middleware(async ({ req }) => {
      const session = await auth.api.getSession({
        headers: req.headers,
      });
      const user = session?.user;

      if (!user) throw new UploadThingError("Unauthorized");

      const resolvedRole = await resolveSessionRole(user as { id: string; role?: unknown });

      if (!isWorkerRole(resolvedRole)) {
        throw new UploadThingError("Only worker accounts can upload community media");
      }

      return {
        userId: user.id,
        userRole: resolvedRole,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const mediaType = file.type?.startsWith("video/") ? "VIDEO" : "IMAGE";
      const fileUrl = file.ufsUrl ?? (file as { url?: string }).url;

      if (!fileUrl) {
        throw new UploadThingError("Upload completed but no file URL was returned");
      }

      return {
        uploadedBy: metadata.userId,
        userRole: metadata.userRole,
        fileUrl,
        fileKey: file.key,
        mediaType,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
