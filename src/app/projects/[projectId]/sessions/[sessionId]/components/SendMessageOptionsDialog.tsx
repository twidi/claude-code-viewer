import { Trans } from "@lingui/react";
import { AlertTriangleIcon, LoaderIcon } from "lucide-react";
import { type FC, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SendMessageOption = "inject" | "queue" | "abort";

export interface SendMessageOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (option: SendMessageOption) => void;
  isLoading: boolean;
}

export const SendMessageOptionsDialog: FC<SendMessageOptionsDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}) => {
  const [selectedOption, setSelectedOption] =
    useState<SendMessageOption>("inject");

  const handleConfirm = () => {
    onConfirm(selectedOption);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans
              id="chat.send_options.title"
              message="How would you like to send this message?"
            />
          </DialogTitle>
          <DialogDescription>
            <Trans
              id="chat.send_options.description"
              message="Claude is currently working. How would you like to proceed?"
            />
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          {/* Inject option */}
          <Label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
              selectedOption === "inject"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50",
              isLoading && "pointer-events-none opacity-50",
            )}
          >
            <input
              type="radio"
              name="sendOption"
              value="inject"
              checked={selectedOption === "inject"}
              onChange={() => setSelectedOption("inject")}
              disabled={isLoading}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  <Trans
                    id="chat.send_options.inject.label"
                    message="Send Now"
                  />
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                <Trans
                  id="chat.send_options.inject.description"
                  message="Claude will read this at the next opportunity while continuing to work. Due to a bug in the Claude Agent SDK, Claude may receive the message twice and it won't appear in the conversation."
                />
              </span>
            </div>
          </Label>

          {/* Queue option */}
          <Label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
              selectedOption === "queue"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50",
              isLoading && "pointer-events-none opacity-50",
            )}
          >
            <input
              type="radio"
              name="sendOption"
              value="queue"
              checked={selectedOption === "queue"}
              onChange={() => setSelectedOption("queue")}
              disabled={isLoading}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  <Trans
                    id="chat.send_options.queue.label"
                    message="Queue for Later"
                  />
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                <Trans
                  id="chat.send_options.queue.description"
                  message="Your message will be sent when Claude finishes the current task."
                />
              </span>
            </div>
          </Label>

          {/* Abort option */}
          <Label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
              selectedOption === "abort"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50",
              isLoading && "pointer-events-none opacity-50",
            )}
          >
            <input
              type="radio"
              name="sendOption"
              value="abort"
              checked={selectedOption === "abort"}
              onChange={() => setSelectedOption("abort")}
              disabled={isLoading}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  <Trans
                    id="chat.send_options.abort.label"
                    message="Abort & Send"
                  />
                </span>
                <AlertTriangleIcon className="h-4 w-4 text-warning" />
              </div>
              <span className="text-sm text-muted-foreground">
                <Trans
                  id="chat.send_options.abort.description"
                  message="Abort current session and restart with your message. Progress may be lost."
                />
              </span>
            </div>
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            <Trans id="common.cancel" message="Cancel" />
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <LoaderIcon className="h-4 w-4 animate-spin" />
            ) : (
              <Trans id="common.confirm" message="Confirm" />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
