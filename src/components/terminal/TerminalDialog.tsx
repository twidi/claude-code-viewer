"use client";

import { Trans } from "@lingui/react";
import {
  Check,
  ClipboardCopy,
  MessageSquarePlus,
  TerminalIcon,
  Trash2,
} from "lucide-react";
import { type FC, useCallback, useEffect, useState } from "react";
import {
  PersistentDialogShell,
  useDialogShell,
} from "@/components/PersistentDialogShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTerminalComment } from "@/contexts/TerminalCommentContext";
import {
  clearTerminal,
  clearTerminalSelection,
  copyTerminalSelection,
  getTerminalSelection,
  TerminalPanel,
  type TouchMode,
} from "./TerminalPanel";

// ============================================================================
// TerminalDialogContent - internal component rendered inside PersistentDialogShell
// ============================================================================

const TerminalDialogContent: FC = () => {
  // Context for inserting text into chat
  const { insertText } = useTerminalComment();
  const dialogShell = useDialogShell();

  // Touch mode toggle for mobile: scroll vs select
  const [touchMode, setTouchMode] = useState<TouchMode>("scroll");
  // Track selection state: char count (0 = no selection)
  const [selectionCharCount, setSelectionCharCount] = useState(0);
  // Track copy feedback notification
  const [copiedCharCount, setCopiedCharCount] = useState<number | null>(null);
  // Track "added to chat" feedback notification
  const [addedCharCount, setAddedCharCount] = useState<number | null>(null);

  const handleSelectionChange = useCallback(
    (_hasSelection: boolean, charCount: number) => {
      setSelectionCharCount(charCount);
    },
    [],
  );

  const handleCopy = useCallback(() => {
    const charCount = copyTerminalSelection();
    if (charCount !== null) {
      setSelectionCharCount(0);
      setCopiedCharCount(charCount);
    }
  }, []);

  const handleAddToChat = useCallback(() => {
    const selection = getTerminalSelection();
    if (selection) {
      // Wrap the selection in a markdown code block for terminal output
      const formattedText = `\`\`\`\n${selection}\n\`\`\``;
      insertText(formattedText);
      const charCount = selection.length;
      clearTerminalSelection();
      setSelectionCharCount(0);
      setAddedCharCount(charCount);

      // Close the dialog so user can see the chat input
      dialogShell?.hide();
    }
  }, [insertText, dialogShell]);

  // Auto-hide copy notification after 2 seconds
  useEffect(() => {
    if (copiedCharCount === null) return;

    const timer = setTimeout(() => setCopiedCharCount(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedCharCount]);

  // Auto-hide "added to chat" notification after 2 seconds
  useEffect(() => {
    if (addedCharCount === null) return;

    const timer = setTimeout(() => setAddedCharCount(null), 2000);
    return () => clearTimeout(timer);
  }, [addedCharCount]);

  return (
    <>
      <PersistentDialogShell.Header>
        <TerminalIcon className="w-5 h-5" />
        <span className="font-medium">
          <Trans id="terminal.title" />
        </span>

        {/* Selection info and action buttons - visible on all screen sizes */}
        <div className="ml-auto flex items-center gap-1">
          {/* Copy success notification */}
          {copiedCharCount !== null && (
            <div className="flex items-center gap-1.5 h-7 px-2 bg-green-500 text-white rounded-md text-sm">
              <Check className="w-3.5 h-3.5" />
              <Trans
                id="terminal.copied_count"
                values={{ count: copiedCharCount }}
              />
            </div>
          )}

          {/* Added to chat notification */}
          {addedCharCount !== null && copiedCharCount === null && (
            <div className="flex items-center gap-1.5 h-7 px-2 bg-green-500 text-white rounded-md text-sm">
              <Check className="w-3.5 h-3.5" />
              <Trans
                id="terminal.added_to_chat_count"
                values={{ count: addedCharCount }}
              />
            </div>
          )}

          {/* Selection info and action buttons - shown when there's a selection */}
          {selectionCharCount > 0 &&
            copiedCharCount === null &&
            addedCharCount === null && (
              <>
                {/* Selection count text */}
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <Trans
                    id="terminal.selection_count"
                    values={{ count: selectionCharCount }}
                  />
                </span>

                {/* Copy button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1 h-7 px-2"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  <Trans id="terminal.copy" />
                </Button>

                {/* Add to chat button */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddToChat}
                  className="gap-1 h-7 px-2 bg-blue-500 hover:bg-blue-600"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <Trans id="terminal.add_to_chat" />
                </Button>
              </>
            )}

          {/* Touch mode switch - only visible on mobile */}
          <div className="flex items-center gap-2.5 md:hidden">
            <button
              type="button"
              onClick={() => setTouchMode("scroll")}
              className={`text-xs ${touchMode === "scroll" ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              <Trans id="terminal.mode.scroll" />
            </button>
            <Switch
              checked={touchMode === "select"}
              onCheckedChange={(checked) =>
                setTouchMode(checked ? "select" : "scroll")
              }
            />
            <button
              type="button"
              onClick={() => setTouchMode("select")}
              className={`text-xs ${touchMode === "select" ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              <Trans id="terminal.mode.select" />
            </button>
          </div>

          {/* Clear terminal button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="gap-1 h-7 px-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <Trans id="terminal.clear" />
          </Button>
        </div>
      </PersistentDialogShell.Header>

      <PersistentDialogShell.Content className="p-0">
        <TerminalPanel
          touchMode={touchMode}
          onSelectionChange={handleSelectionChange}
        />
      </PersistentDialogShell.Content>
    </>
  );
};

// ============================================================================
// TerminalDialog - wrapper component that uses PersistentDialogShell
// ============================================================================

/**
 * TerminalDialog - Persistent dialog wrapper for the terminal.
 *
 * Key differences from Git/Files dialogs:
 * - No resetKey: The terminal NEVER resets on session/project changes
 * - No closeConfirmation: No state to lose (terminal keeps running in background)
 * - No badgeCount: Terminal has no pending notifications
 *
 * The terminal is truly global and persistent - it survives all navigation
 * and only terminates when the application is closed.
 */
export const TerminalDialog: FC = () => {
  return (
    <PersistentDialogShell
      dialogId="terminal"
      config={{
        icon: TerminalIcon,
        label: <Trans id="control.terminal" />,
        // No badgeCount for terminal
      }}
      // No resetKey - terminal never resets
      // No closeConfirmation - no state to lose
    >
      <TerminalDialogContent />
    </PersistentDialogShell>
  );
};
