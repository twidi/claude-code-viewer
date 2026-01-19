import type { FC, RefObject } from "react";
import { useMemo } from "react";
import {
  CommandCompletion,
  type CommandCompletionRef,
} from "./CommandCompletion";
import { FileCompletion, type FileCompletionRef } from "./FileCompletion";

interface PositionStyle {
  top: number;
  left: number;
}

// Widget heights (must match respective component styles)
// CommandCompletion: height: "15rem" = 240px
const COMMAND_COMPLETION_HEIGHT = 240;
// FileCompletion: height: "20rem" = 320px
const FILE_COMPLETION_HEIGHT = 320;
// Approximate line height for cursor offset
const LINE_HEIGHT = 24;
// Safety margin for viewport edge detection
const VIEWPORT_MARGIN = 20;
// Margin between widget and cursor
const WIDGET_MARGIN = 8;

type CompletionType = "command" | "file";

/**
 * Calculates the final top position for the completion popup.
 *
 * The popup is positioned directly using the calculated top value.
 * For "below": widget top starts just below the cursor line
 * For "above": widget top is calculated so the widget appears above the cursor
 *
 * Note: FileCompletion has a nested structure where the actual content (listRef)
 * is positioned absolutely within a relative container. The CSS classes
 * top-full/bottom-full don't work as expected with this structure, so we
 * calculate the final position directly.
 */
const calculateOptimalPosition = (
  relativeCursorPosition: { top: number; left: number },
  absoluteCursorPosition: { top: number; left: number },
  completionType: CompletionType,
): PositionStyle => {
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportCenter = viewportHeight / 2;

  // Use the height of the widget that will be displayed
  const estimatedHeight =
    completionType === "command"
      ? COMMAND_COMPLETION_HEIGHT
      : FILE_COMPLETION_HEIGHT;

  // Determine preferred placement based on cursor position in viewport
  const isInUpperHalf = absoluteCursorPosition.top < viewportCenter;

  // Calculate available space
  const spaceBelow =
    viewportHeight - absoluteCursorPosition.top - LINE_HEIGHT - VIEWPORT_MARGIN;
  const spaceAbove = absoluteCursorPosition.top - VIEWPORT_MARGIN;

  let top: number;

  if (isInUpperHalf && spaceBelow >= estimatedHeight) {
    // Cursor in upper half with enough space below - place below
    // Widget top = cursor position + line height
    top = relativeCursorPosition.top + LINE_HEIGHT;
  } else if (!isInUpperHalf && spaceAbove >= estimatedHeight) {
    // Cursor in lower half with enough space above - place above
    // Widget top = cursor position - widget height - margin
    top = relativeCursorPosition.top - estimatedHeight - WIDGET_MARGIN;
  } else {
    // Fallback: use whichever side has more space
    if (spaceBelow > spaceAbove) {
      top = relativeCursorPosition.top + LINE_HEIGHT;
    } else {
      top = relativeCursorPosition.top - estimatedHeight - WIDGET_MARGIN;
    }
  }

  // Ensure left position stays within viewport bounds
  const estimatedCompletionWidth = 512;
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1200;
  const maxLeft = viewportWidth - estimatedCompletionWidth - 16;
  const adjustedLeft = Math.max(
    16,
    Math.min(relativeCursorPosition.left - 16, maxLeft),
  );

  return {
    top,
    left: adjustedLeft,
  };
};

export const InlineCompletion: FC<{
  projectId: string;
  message: string;
  cursorIndex: number;
  commandCompletionRef: RefObject<CommandCompletionRef | null>;
  fileCompletionRef: RefObject<FileCompletionRef | null>;
  handleCommandSelect: (command: string) => void;
  handleFileSelect: (newMessage: string, newCursorPosition: number) => void;
  cursorPosition: {
    relative: { top: number; left: number };
    absolute: { top: number; left: number };
  };
}> = ({
  projectId,
  message,
  cursorIndex,
  commandCompletionRef,
  fileCompletionRef,
  handleCommandSelect,
  handleFileSelect,
  cursorPosition,
}) => {
  // Determine which completion widget will be shown
  // Command completion: message starts with "/"
  // File completion: message contains "@" before cursor
  const completionType: CompletionType = useMemo(() => {
    if (message.startsWith("/")) {
      return "command";
    }
    return "file";
  }, [message]);

  const position = useMemo(() => {
    return calculateOptimalPosition(
      cursorPosition.relative,
      cursorPosition.absolute,
      completionType,
    );
  }, [cursorPosition, completionType]);

  return (
    <div
      className="absolute w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl z-50"
      style={{
        top: position.top,
        left: position.left,
        maxWidth:
          typeof window !== "undefined"
            ? Math.min(512, window.innerWidth * 0.8)
            : 512,
      }}
    >
      <CommandCompletion
        ref={commandCompletionRef}
        projectId={projectId}
        inputValue={message}
        onCommandSelect={handleCommandSelect}
      />
      <FileCompletion
        ref={fileCompletionRef}
        projectId={projectId}
        inputValue={message}
        cursorIndex={cursorIndex}
        onFileSelect={handleFileSelect}
      />
    </div>
  );
};
