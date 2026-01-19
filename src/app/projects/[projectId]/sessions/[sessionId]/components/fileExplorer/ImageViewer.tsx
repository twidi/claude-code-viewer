import type { FC } from "react";

interface ImageViewerProps {
  /** Base64-encoded image content */
  content: string;
  /** MIME type of the image (e.g., "image/png", "image/jpeg") */
  mimeType: string;
  /** Name of the image file (used for alt text) */
  fileName: string;
}

/**
 * Component to display base64-encoded images.
 * Renders the image centered with proper sizing and a subtle border.
 */
export const ImageViewer: FC<ImageViewerProps> = ({
  content,
  mimeType,
  fileName,
}) => {
  const src = `data:${mimeType};base64,${content}`;

  return (
    <div className="flex items-center justify-center h-full p-4 overflow-auto">
      <img
        src={src}
        alt={fileName}
        className="max-w-full max-h-full object-contain rounded border border-gray-200 dark:border-gray-700"
      />
    </div>
  );
};
