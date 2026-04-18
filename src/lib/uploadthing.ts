import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";

const uploadthingApiUrl = "/api/uploadthing";

export const UploadButton = generateUploadButton<OurFileRouter>({
  url: uploadthingApiUrl,
});

export const UploadDropzone = generateUploadDropzone<OurFileRouter>({
  url: uploadthingApiUrl,
});
