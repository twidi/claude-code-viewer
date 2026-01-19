import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
} from "react";
import type { SendMessageOption } from "@/app/projects/[projectId]/sessions/[sessionId]/components/SendMessageOptionsDialog";

const DEFAULT_OPTION: SendMessageOption = "inject";

interface SendOptionMemoryContextValue {
  getOption: (sessionId: string) => SendMessageOption;
  setOption: (sessionId: string, option: SendMessageOption) => void;
  resetOption: (sessionId: string) => void;
}

const SendOptionMemoryContext =
  createContext<SendOptionMemoryContextValue | null>(null);

export const SendOptionMemoryProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const memoryRef = useRef<Map<string, SendMessageOption>>(new Map());

  const getOption = useCallback((sessionId: string): SendMessageOption => {
    return memoryRef.current.get(sessionId) ?? DEFAULT_OPTION;
  }, []);

  const setOption = useCallback(
    (sessionId: string, option: SendMessageOption) => {
      memoryRef.current.set(sessionId, option);
    },
    [],
  );

  const resetOption = useCallback((sessionId: string) => {
    memoryRef.current.delete(sessionId);
  }, []);

  return (
    <SendOptionMemoryContext.Provider
      value={{ getOption, setOption, resetOption }}
    >
      {children}
    </SendOptionMemoryContext.Provider>
  );
};

export const useSendOptionMemory = (): SendOptionMemoryContextValue => {
  const context = useContext(SendOptionMemoryContext);
  if (!context) {
    throw new Error(
      "useSendOptionMemory must be used within SendOptionMemoryProvider",
    );
  }
  return context;
};
