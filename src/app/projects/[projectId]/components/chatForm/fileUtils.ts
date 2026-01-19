import {
  type DocumentBlockParam,
  type ImageBlockParam,
  mediaTypeSchema,
} from "../../../../../server/core/claude-code/schema";

/** Supported image MIME types for attachments */
export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/** Supported document MIME types for attachments */
export const SUPPORTED_DOCUMENT_TYPES = ["application/pdf"] as const;

/** Supported text MIME types for attachments */
export const SUPPORTED_TEXT_TYPES = ["text/plain"] as const;

/** All supported MIME types for attachments */
export const SUPPORTED_MIME_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES,
  ...SUPPORTED_TEXT_TYPES,
] as const;

export type FileType = "text" | "image" | "pdf";

/**
 * Determine file type based on MIME type
 */
export const determineFileType = (mimeType: string): FileType => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  return "text";
};

/**
 * Check if MIME type is supported
 */
export const isSupportedMimeType = (mimeType: string): boolean => {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
};

/**
 * Convert File to base64 encoded string (without data URL prefix)
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(",")[1];
        resolve(base64 ?? "");
      } else {
        reject(new Error("Failed to read file as base64"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Convert File to plain text
 */
export const fileToText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsText(file);
  });
};

/**
 * Process an image file immediately and return ImageBlockParam
 * Used for drag & drop where file references may become invalid
 */
export const processImageImmediately = async (
  file: File,
): Promise<ImageBlockParam | null> => {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  const mediaType = mediaTypeSchema.safeParse(file.type);
  if (!mediaType.success) {
    return null;
  }

  const base64Data = await fileToBase64(file);

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mediaType.data,
      data: base64Data,
    },
  };
};

/**
 * Process a file and return appropriate block structure
 */
export const processFile = async (
  file: File,
): Promise<
  | { type: "text"; content: string }
  | { type: "image"; block: ImageBlockParam }
  | { type: "document"; block: DocumentBlockParam }
  | null
> => {
  const fileType = determineFileType(file.type);

  if (fileType === "text") {
    const content = await fileToText(file);
    return { type: "text", content };
  }

  const base64Data = await fileToBase64(file);

  if (fileType === "image") {
    const mediaType = mediaTypeSchema.safeParse(file.type);
    if (!mediaType.success) {
      return null;
    }

    return {
      type: "image",
      block: {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType.data,
          data: base64Data,
        },
      },
    };
  }

  // PDF
  return {
    type: "document",
    block: {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64Data,
      },
    },
  };
};
