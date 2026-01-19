import { Trans } from "@lingui/react";
import { ChevronDown, FileText, Image as ImageIcon } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  DocumentBlockParam,
  ImageBlockParam,
} from "@/server/core/claude-code/schema";

type AttachedImageProps = {
  image: ImageBlockParam;
  id?: string;
  /** Use "compact" for smaller displays like scheduled messages */
  variant?: "default" | "compact";
};

export const AttachedImage: FC<AttachedImageProps> = ({
  image,
  id,
  variant = "default",
}) => {
  const maxHeight = variant === "compact" ? "max-h-48" : "max-h-96";
  const padding =
    variant === "compact"
      ? "py-2 px-3"
      : "py-3 px-4 border-t border-purple-200 dark:border-purple-800";

  return (
    <Card
      className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20 mb-2 p-0 overflow-hidden"
      id={id}
    >
      <Collapsible>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors px-3 py-1.5 group">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium">
                <Trans id="user.content.image" />
              </span>
              <Badge
                variant="outline"
                className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300"
              >
                {image.source.media_type}
              </Badge>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 ml-auto" />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={padding}>
            <div className="rounded-lg border overflow-hidden bg-background">
              <img
                src={`data:${image.source.media_type};base64,${image.source.data}`}
                alt="Attached content"
                className={`max-w-full h-auto ${maxHeight} object-contain`}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

type AttachedPdfProps = {
  document: DocumentBlockParam & { source: { type: "base64" } };
  id?: string;
  variant?: "default" | "compact";
};

export const AttachedPdf: FC<AttachedPdfProps> = ({
  document,
  id,
  variant = "default",
}) => {
  const height = variant === "compact" ? "h-[400px]" : "h-[600px]";
  const padding =
    variant === "compact"
      ? "py-2 px-3"
      : "py-3 px-4 border-t border-blue-200 dark:border-blue-800";

  return (
    <Card
      className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 mb-2 p-0 overflow-hidden"
      id={id}
    >
      <Collapsible>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors px-3 py-1.5 group">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">
                <Trans id="user.content.document.pdf" />
              </span>
              <Badge
                variant="outline"
                className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
              >
                {document.source.media_type}
              </Badge>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 ml-auto" />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={padding}>
            <div className="rounded-lg border overflow-hidden bg-background">
              <embed
                src={`data:${document.source.media_type};base64,${document.source.data}`}
                type="application/pdf"
                className={`w-full ${height}`}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

type AttachedTextProps = {
  document: DocumentBlockParam & { source: { type: "text" } };
  id?: string;
  variant?: "default" | "compact";
};

export const AttachedText: FC<AttachedTextProps> = ({
  document,
  id,
  variant = "default",
}) => {
  const maxHeight = variant === "compact" ? "max-h-48" : "max-h-96";
  const padding =
    variant === "compact"
      ? "py-2 px-3"
      : "py-3 px-4 border-t border-green-200 dark:border-green-800";
  const prePadding = variant === "compact" ? "p-3" : "p-4";

  return (
    <Card
      className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 mb-2 p-0 overflow-hidden"
      id={id}
    >
      <Collapsible>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-900/20 transition-colors px-3 py-1.5 group">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">
                <Trans id="user.content.document.text" />
              </span>
              <Badge
                variant="outline"
                className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-300"
              >
                {document.source.media_type}
              </Badge>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 ml-auto" />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={padding}>
            <div className="rounded-lg border overflow-hidden bg-background">
              <pre
                className={`${prePadding} text-sm overflow-auto ${maxHeight}`}
              >
                {document.source.data}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

type AttachedDocumentProps = {
  document: DocumentBlockParam;
  id?: string;
  variant?: "default" | "compact";
};

export const AttachedDocument: FC<AttachedDocumentProps> = ({
  document,
  id,
  variant = "default",
}) => {
  if (document.source.type === "base64") {
    return (
      <AttachedPdf
        document={
          document as DocumentBlockParam & { source: { type: "base64" } }
        }
        id={id}
        variant={variant}
      />
    );
  }

  return (
    <AttachedText
      document={document as DocumentBlockParam & { source: { type: "text" } }}
      id={id}
      variant={variant}
    />
  );
};
