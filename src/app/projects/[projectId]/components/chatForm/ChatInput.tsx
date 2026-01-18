import { Trans, useLingui } from "@lingui/react";
import {
  AlertCircleIcon,
  LoaderIcon,
  PaperclipIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";
import {
  type FC,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useDiffLineComment } from "@/contexts/DiffLineCommentContext";
import { useFileExplorerComment } from "@/contexts/FileExplorerCommentContext";
import { useTerminalComment } from "@/contexts/TerminalCommentContext";
import {
  AttachmentList,
  type PendingAttachment,
} from "../../../../../components/AttachmentList";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { Textarea } from "../../../../../components/ui/textarea";
import { useCreateSchedulerJob } from "../../../../../hooks/useScheduler";
import type {
  DocumentBlockParam,
  ImageBlockParam,
} from "../../../../../server/core/claude-code/schema";
import { useConfig } from "../../../../hooks/useConfig";
import type { CommandCompletionRef } from "./CommandCompletion";
import type { FileCompletionRef } from "./FileCompletion";
import {
  isSupportedMimeType,
  processFile,
  processImageImmediately,
} from "./fileUtils";
import { InlineCompletion } from "./InlineCompletion";
import { useDraftMessage } from "./useDraftMessage";

export interface MessageInput {
  text: string;
  images?: ImageBlockParam[];
  documents?: DocumentBlockParam[];
}

export interface ChatInputProps {
  projectId: string;
  onSubmit: (input: MessageInput) => Promise<void>;
  isPending: boolean;
  error?: Error | null;
  placeholder: string;
  buttonText: React.ReactNode;
  minHeight?: string;
  containerClassName?: string;
  disabled?: boolean;
  buttonSize?: "sm" | "default" | "lg";
  enableScheduledSend?: boolean;
  baseSessionId?: string | null;
  /**
   * When true, shows the send mode dropdown with "Queue Now" instead of "Send Now".
   * The actual queuing behavior is handled by the parent via onSubmit.
   */
  showQueueOption?: boolean;
  /**
   * Message to restore to the input (e.g., when user cancels a dialog).
   * When set, the message text will be populated into the input.
   */
  restoredMessage?: MessageInput | null;
  /**
   * Callback when the restored message has been applied.
   * Parent should clear restoredMessage after this is called.
   */
  onMessageRestored?: () => void;
}

export const ChatInput: FC<ChatInputProps> = ({
  projectId,
  onSubmit,
  isPending,
  error,
  placeholder,
  buttonText,
  minHeight: minHeightProp = "min-h-[64px]",
  containerClassName = "",
  disabled = false,
  buttonSize = "lg",
  enableScheduledSend = false,
  baseSessionId = null,
  showQueueOption = false,
  restoredMessage = null,
  onMessageRestored,
}) => {
  // Parse minHeight prop to get pixel value (default to 48px for 1.5 lines)
  // Supports both "200px" and Tailwind format like "min-h-[200px]"
  const parseMinHeight = (value: string): number => {
    // Try to extract pixel value using regex (handles both formats)
    const match = value.match(/(\d+)px/);
    if (match?.[1]) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    // Fallback to default
    return 48;
  };
  const minHeightValue = parseMinHeight(minHeightProp);
  const { i18n } = useLingui();
  const { draft, setDraft, clearDraft } = useDraftMessage(
    projectId,
    baseSessionId,
  );
  const [message, setMessage] = useState(draft);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [cursorPosition, setCursorPosition] = useState<{
    relative: { top: number; left: number };
    absolute: { top: number; left: number };
  }>({ relative: { top: 0, left: 0 }, absolute: { top: 0, left: 0 } });
  // Track cursor index in the text for completion parsing
  const [cursorIndex, setCursorIndex] = useState(0);
  const [isDraggingOnPage, setIsDraggingOnPage] = useState(false);
  const [isDraggingOnZone, setIsDraggingOnZone] = useState(false);
  const dragCounterRef = useRef(0);
  const zoneDragCounterRef = useRef(0);
  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">(
    "immediate",
  );
  const [scheduledTime, setScheduledTime] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandCompletionRef = useRef<CommandCompletionRef>(null);
  const fileCompletionRef = useRef<FileCompletionRef>(null);
  const helpId = useId();
  const { config } = useConfig();
  const createSchedulerJob = useCreateSchedulerJob();

  // Auto-resize textarea based on content
  // biome-ignore lint/correctness/useExhaustiveDependencies: message is intentionally included to trigger resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    // Set height to scrollHeight, but respect min/max constraints
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 200; // Maximum height in pixels (approx 5 lines)
    textarea.style.height = `${Math.max(minHeightValue, Math.min(scrollHeight, maxHeight))}px`;
  }, [message, minHeightValue]);

  // Set initial height to 1 line on mount
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Set initial height to minHeight value
    textarea.style.height = `${minHeightValue}px`;
  }, [minHeightValue]);

  // Restore message when restoredMessage prop is set
  useEffect(() => {
    if (restoredMessage) {
      setMessage(restoredMessage.text);
      setDraft(restoredMessage.text);
      // TODO: Also restore images/documents if needed
      onMessageRestored?.();
      textareaRef.current?.focus();
    }
  }, [restoredMessage, onMessageRestored, setDraft]);

  // Register callback for inserting text from diff line comments, file explorer comments, and terminal
  const { registerInsertCallback: registerDiffInsertCallback } =
    useDiffLineComment();
  const { registerInsertCallback: registerFileExplorerInsertCallback } =
    useFileExplorerComment();
  const { registerInsertCallback: registerTerminalInsertCallback } =
    useTerminalComment();
  useEffect(() => {
    const insertTextAtCursor = (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        // Fallback: append to current message
        setMessage((prev) => {
          const separator = prev.trim() ? "\n\n" : "";
          const newValue = prev + separator + text;
          setDraft(newValue);
          return newValue;
        });
        return;
      }

      // Get current cursor position (or end of text if not focused)
      const start = textarea.selectionStart ?? message.length;
      const end = textarea.selectionEnd ?? message.length;

      // Determine separator based on context
      const beforeCursor = message.slice(0, start);
      const afterCursor = message.slice(end);
      const needsLeadingSeparator =
        beforeCursor.trim() && !beforeCursor.endsWith("\n\n");
      const needsTrailingSeparator =
        afterCursor.trim() && !afterCursor.startsWith("\n");

      const leadingSep = needsLeadingSeparator ? "\n\n" : "";
      const trailingSep = needsTrailingSeparator ? "\n\n" : "";

      const newValue =
        beforeCursor + leadingSep + text + trailingSep + afterCursor;
      setMessage(newValue);
      setDraft(newValue);

      // Set cursor position after inserted text
      const newCursorPos =
        start + leadingSep.length + text.length + trailingSep.length;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    };

    // Register the same callback with all contexts
    const unregisterDiff = registerDiffInsertCallback(insertTextAtCursor);
    const unregisterFileExplorer =
      registerFileExplorerInsertCallback(insertTextAtCursor);
    const unregisterTerminal =
      registerTerminalInsertCallback(insertTextAtCursor);

    return () => {
      unregisterDiff();
      unregisterFileExplorer();
      unregisterTerminal();
    };
  }, [
    registerDiffInsertCallback,
    registerFileExplorerInsertCallback,
    registerTerminalInsertCallback,
    message,
    setDraft,
  ]);

  // Global drag listeners to detect when files are dragged anywhere on the page
  useEffect(() => {
    const handleGlobalDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDraggingOnPage(true);
      }
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDraggingOnPage(false);
      }
    };

    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOnPage(false);
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener("dragenter", handleGlobalDragEnter);
    document.addEventListener("dragleave", handleGlobalDragLeave);
    document.addEventListener("drop", handleGlobalDrop);
    document.addEventListener("dragover", handleGlobalDragOver);

    return () => {
      document.removeEventListener("dragenter", handleGlobalDragEnter);
      document.removeEventListener("dragleave", handleGlobalDragLeave);
      document.removeEventListener("drop", handleGlobalDrop);
      document.removeEventListener("dragover", handleGlobalDragOver);
    };
  }, []);

  const handleSubmit = async () => {
    if (!message.trim() && pendingAttachments.length === 0) return;

    const images: ImageBlockParam[] = [];
    const documents: DocumentBlockParam[] = [];

    for (const attachment of pendingAttachments) {
      if (attachment.type === "image") {
        // Already-read image (from drag & drop)
        images.push(attachment.data);
      } else {
        // File reference - read now
        const result = await processFile(attachment.file);

        if (result === null) {
          continue;
        }

        if (result.type === "text") {
          documents.push({
            type: "document",
            source: {
              type: "text",
              media_type: "text/plain",
              data: result.content,
            },
          });
        } else if (result.type === "image") {
          images.push(result.block);
        } else if (result.type === "document") {
          documents.push(result.block);
        }
      }
    }

    // Scheduled send - always available, creates a reserved job
    if (sendMode === "scheduled") {
      // Create a scheduler job for scheduled send
      const match = scheduledTime.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
      );
      if (!match) {
        throw new Error("Invalid datetime format");
      }
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hours = Number(match[4]);
      const minutes = Number(match[5]);
      const localDate = new Date(year, month - 1, day, hours, minutes);

      try {
        await createSchedulerJob.mutateAsync({
          name: `Scheduled message at ${scheduledTime}`,
          schedule: {
            type: "reserved",
            reservedExecutionTime: localDate.toISOString(),
          },
          message: {
            content: message,
            projectId,
            baseSessionId,
          },
          enabled: true,
        });

        toast.success(
          i18n._({
            id: "chat.scheduled_send.success",
            message: "Message scheduled successfully",
          }),
          {
            description: i18n._({
              id: "chat.scheduled_send.success_description",
              message: "You can view and manage it in the Scheduler tab",
            }),
          },
        );

        setMessage("");
        setPendingAttachments([]);
        clearDraft();
      } catch (error) {
        toast.error(
          i18n._({
            id: "chat.scheduled_send.failed",
            message: "Failed to schedule message",
          }),
          {
            description: error instanceof Error ? error.message : undefined,
          },
        );
      }
    } else {
      // Immediate send - clear UI before async operation
      const textToSend = message;
      const imagesToSend = images.length > 0 ? images : undefined;
      const documentsToSend = documents.length > 0 ? documents : undefined;
      const attachmentsToRestore = [...pendingAttachments];

      setMessage("");
      setPendingAttachments([]);
      clearDraft();

      try {
        await onSubmit({
          text: textToSend,
          images: imagesToSend,
          documents: documentsToSend,
        });
      } catch {
        // Restore message and attachments on failure so user doesn't lose their input
        setMessage(textToSend);
        setPendingAttachments(attachmentsToRestore);
        setDraft(textToSend);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    addFiles(Array.from(files));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const addFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments: PendingAttachment[] = fileArray.map((file) => ({
      type: "file",
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
    }));
    setPendingAttachments((prev) => [...prev, ...newAttachments]);

    // Switch to immediate mode if in scheduled mode (scheduled send doesn't support attachments)
    if (sendMode === "scheduled") {
      setSendMode("immediate");
      toast.info(
        i18n._({
          id: "chat.send_mode.switched_to_immediate",
          message:
            "Switched to immediate send (scheduled send doesn't support attachments)",
        }),
      );
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData.files;
    if (files.length === 0) return;

    const supportedFiles = Array.from(files).filter((file) =>
      isSupportedMimeType(file.type),
    );
    if (supportedFiles.length > 0) {
      addFiles(supportedFiles);
    }
  };

  const handleZoneDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    zoneDragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingOnZone(true);
    }
  };

  const handleZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    zoneDragCounterRef.current--;
    if (zoneDragCounterRef.current === 0) {
      setIsDraggingOnZone(false);
    }
  };

  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleZoneDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    zoneDragCounterRef.current = 0;
    setIsDraggingOnZone(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const supportedFiles = Array.from(files).filter((file) =>
      isSupportedMimeType(file.type),
    );
    if (supportedFiles.length === 0) return;

    // Separate images from other files
    // Images are read immediately to avoid issues with temporary blob references
    // (e.g., from screenshot tools where the file reference may become invalid)
    const imageFiles = supportedFiles.filter((file) =>
      file.type.startsWith("image/"),
    );
    const otherFiles = supportedFiles.filter(
      (file) => !file.type.startsWith("image/"),
    );

    const newAttachments: PendingAttachment[] = [];

    // Read images immediately
    if (imageFiles.length > 0) {
      const imagePromises = imageFiles.map(async (file) => {
        const imageData = await processImageImmediately(file);
        if (imageData) {
          return {
            type: "image" as const,
            data: imageData,
            name: file.name || `image.${file.type.split("/")[1]}`,
            id: `${file.name}-${Date.now()}-${Math.random()}`,
          };
        }
        return null;
      });

      const results = await Promise.all(imagePromises);
      for (const result of results) {
        if (result !== null) {
          newAttachments.push(result);
        }
      }
    }

    // Add other files as file references (they will be read at submit time)
    for (const file of otherFiles) {
      newAttachments.push({
        type: "file",
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
      });
    }

    if (newAttachments.length > 0) {
      setPendingAttachments((prev) => [...prev, ...newAttachments]);

      // Switch to immediate mode if in scheduled mode
      if (sendMode === "scheduled") {
        setSendMode("immediate");
        toast.info(
          i18n._({
            id: "chat.send_mode.switched_to_immediate",
            message:
              "Switched to immediate send (scheduled send doesn't support attachments)",
          }),
        );
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (fileCompletionRef.current?.handleKeyDown(e)) {
      return;
    }

    if (commandCompletionRef.current?.handleKeyDown(e)) {
      return;
    }

    // IMEで変換中の場合は送信しない
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      const enterKeyBehavior = config?.enterKeyBehavior;

      if (enterKeyBehavior === "enter-send" && !e.shiftKey && !e.metaKey) {
        // Enter: Send mode
        e.preventDefault();
        handleSubmit();
      } else if (
        enterKeyBehavior === "shift-enter-send" &&
        e.shiftKey &&
        !e.metaKey
      ) {
        // Shift+Enter: Send mode (default)
        e.preventDefault();
        handleSubmit();
      } else if (
        enterKeyBehavior === "command-enter-send" &&
        e.metaKey &&
        !e.shiftKey
      ) {
        // Command+Enter: Send mode (Mac)
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const getCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    const container = containerRef.current;
    if (textarea === null || container === null) return undefined;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const textAfterCursor = textarea.value.substring(cursorPos);

    const pre = document.createTextNode(textBeforeCursor);
    const post = document.createTextNode(textAfterCursor);
    const caret = document.createElement("span");
    caret.innerHTML = "&nbsp;";

    const mirrored = document.createElement("div");

    mirrored.innerHTML = "";
    mirrored.append(pre, caret, post);

    const textareaStyles = window.getComputedStyle(textarea);
    for (const property of [
      "border",
      "boxSizing",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "padding",
      "textDecoration",
      "textIndent",
      "textTransform",
      "whiteSpace",
      "wordSpacing",
      "wordWrap",
    ] as const) {
      mirrored.style[property] = textareaStyles[property];
    }

    mirrored.style.visibility = "hidden";
    container.prepend(mirrored);

    const caretRect = caret.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    container.removeChild(mirrored);

    return {
      relative: {
        top: caretRect.top - containerRect.top - textarea.scrollTop,
        left: caretRect.left - containerRect.left - textarea.scrollLeft,
      },
      absolute: {
        top: caretRect.top - textarea.scrollTop,
        left: caretRect.left - textarea.scrollLeft,
      },
    };
  }, []);

  const handleCommandSelect = (command: string) => {
    setMessage(command);
    textareaRef.current?.focus();
  };

  const handleFilePathSelect = (
    newMessage: string,
    newCursorPosition: number,
  ) => {
    setMessage(newMessage);
    setDraft(newMessage);
    setCursorIndex(newCursorPosition);

    // Reposition cursor after React updates the textarea
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    });
  };

  return (
    <div className={containerClassName}>
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 dark:text-red-400 bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-xl mb-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
          <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-medium">
            <Trans id="chat.error.send_failed" />
          </span>
        </div>
      )}

      <div
        className="relative group"
        onDragEnter={handleZoneDragEnter}
        onDragLeave={handleZoneDragLeave}
        onDragOver={handleZoneDragOver}
        onDrop={handleZoneDrop}
      >
        <div
          className={`absolute -inset-0.5 rounded-2xl blur transition-opacity duration-300 ${
            isDraggingOnZone
              ? "opacity-100 bg-gradient-to-r from-blue-500/40 via-cyan-500/40 to-blue-500/40"
              : isDraggingOnPage
                ? "opacity-100 bg-gradient-to-r from-blue-500/30 via-cyan-500/30 to-blue-500/30"
                : "opacity-0 group-hover:opacity-100 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20"
          }`}
          aria-hidden="true"
        />

        <div
          className={`relative bg-background border border-border/40 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden ${
            isDraggingOnZone
              ? "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-background"
              : isDraggingOnPage
                ? "ring-2 ring-blue-400/50 dark:ring-blue-500/50 ring-offset-2 ring-offset-background"
                : ""
          }`}
        >
          <div className="relative" ref={containerRef}>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                const newValue = e.target.value;
                const newCursorIndex = e.target.selectionStart;

                // Update cursor position for widget positioning when:
                // - @ is typed anywhere (file completion)
                // - / is typed as the first character (command completion)
                const charTyped = newValue.slice(
                  newCursorIndex - 1,
                  newCursorIndex,
                );
                const isAtTyped = charTyped === "@";
                const isSlashAtStart =
                  charTyped === "/" && newCursorIndex === 1;

                if (isAtTyped || isSlashAtStart) {
                  const position = getCursorPosition();
                  if (position) {
                    setCursorPosition(position);
                  }
                }

                setCursorIndex(newCursorIndex);
                setMessage(newValue);
                setDraft(newValue);
              }}
              onSelect={(e) => {
                // Track cursor movements (arrow keys, mouse clicks)
                setCursorIndex(e.currentTarget.selectionStart);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              className="resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent px-5 py-2 text-base transition-all duration-200 placeholder:text-muted-foreground/60 overflow-y-auto leading-6"
              style={{
                minHeight: `${minHeightValue}px`,
              }}
              disabled={isPending || disabled}
              aria-label={i18n._("Message input with completion support")}
              aria-describedby={helpId}
              aria-expanded={message.startsWith("/") || message.includes("@")}
              aria-haspopup="listbox"
              role="combobox"
              aria-autocomplete="list"
            />
          </div>

          {pendingAttachments.length > 0 && (
            <div className="px-5 py-3 border-t border-border/40">
              <AttachmentList
                existingAttachments={[]}
                pendingAttachments={pendingAttachments}
                onRemoveExisting={() => {}}
                onRemovePending={handleRemoveAttachment}
                disabled={isPending}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 px-5 py-1 bg-muted/30 border-t border-border/40">
            {(enableScheduledSend || showQueueOption) &&
              sendMode === "scheduled" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <Label htmlFor="send-mode-mobile" className="text-xs sr-only">
                    <Trans id="chat.send_mode.label" />
                  </Label>
                  <Select
                    value={sendMode}
                    onValueChange={(value: "immediate" | "scheduled") =>
                      setSendMode(value)
                    }
                    disabled={isPending || disabled}
                  >
                    <SelectTrigger
                      id="send-mode-mobile"
                      className="h-8 w-full sm:w-[140px] text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">
                        <Trans id="chat.send_mode.immediate" />
                      </SelectItem>
                      <SelectItem value="scheduled">
                        <Trans id="chat.send_mode.scheduled" />
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1.5 flex-1">
                    <Label htmlFor="scheduled-time" className="text-xs sr-only">
                      <Trans id="chat.send_mode.scheduled_time" />
                    </Label>
                    <Input
                      id="scheduled-time"
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      disabled={isPending || disabled}
                      className="h-8 w-full sm:w-[180px] text-xs"
                    />
                  </div>
                </div>
              )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending || disabled}
                  className="gap-1.5"
                >
                  <PaperclipIcon className="w-4 h-4" />
                  <span className="text-xs hidden sm:inline">
                    <Trans id="chat.attach_file" />
                  </span>
                </Button>
                <span
                  className="text-xs font-medium text-muted-foreground/80"
                  id={helpId}
                >
                  {message.length}
                </span>
                {(message.startsWith("/") || message.includes("@")) && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium hidden sm:flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" />
                    <Trans id="chat.autocomplete.active" />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(enableScheduledSend || showQueueOption) &&
                  sendMode === "immediate" && (
                    <div className="hidden sm:flex items-center gap-2">
                      <Label
                        htmlFor="send-mode-desktop"
                        className="text-xs sr-only"
                      >
                        <Trans id="chat.send_mode.label" />
                      </Label>
                      <Select
                        value={sendMode}
                        onValueChange={(value: "immediate" | "scheduled") =>
                          setSendMode(value)
                        }
                        disabled={isPending || disabled}
                      >
                        <SelectTrigger
                          id="send-mode-desktop"
                          className="h-8 w-[140px] text-xs"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">
                            <Trans id="chat.send_mode.immediate" />
                          </SelectItem>
                          <SelectItem
                            value="scheduled"
                            disabled={pendingAttachments.length > 0}
                          >
                            {pendingAttachments.length > 0 ? (
                              <Trans
                                id="chat.send_mode.scheduled_disabled_with_attachments"
                                message="Scheduled (not available with attachments)"
                              />
                            ) : (
                              <Trans id="chat.send_mode.scheduled" />
                            )}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                {(enableScheduledSend || showQueueOption) &&
                  sendMode === "immediate" && (
                    <Select
                      value={sendMode}
                      onValueChange={(value: "immediate" | "scheduled") =>
                        setSendMode(value)
                      }
                      disabled={isPending || disabled}
                    >
                      <SelectTrigger className="sm:hidden h-8 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">
                          <Trans id="chat.send_mode.immediate" />
                        </SelectItem>
                        <SelectItem
                          value="scheduled"
                          disabled={pendingAttachments.length > 0}
                        >
                          <Trans id="chat.send_mode.scheduled" />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                <Button
                  onClick={handleSubmit}
                  disabled={
                    (!message.trim() && pendingAttachments.length === 0) ||
                    isPending ||
                    disabled
                  }
                  size={buttonSize}
                  className="gap-2 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-muted disabled:to-muted disabled:text-muted-foreground"
                >
                  {isPending ? (
                    <>
                      <LoaderIcon className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">
                        <Trans id="chat.status.processing" />
                      </span>
                    </>
                  ) : (
                    <>
                      <SendIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">{buttonText}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <InlineCompletion
          projectId={projectId}
          message={message}
          cursorIndex={cursorIndex}
          commandCompletionRef={commandCompletionRef}
          fileCompletionRef={fileCompletionRef}
          handleCommandSelect={handleCommandSelect}
          handleFileSelect={handleFilePathSelect}
          cursorPosition={cursorPosition}
        />
      </div>
    </div>
  );
};
