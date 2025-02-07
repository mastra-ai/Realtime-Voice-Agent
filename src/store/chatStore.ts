import { create } from 'zustand';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  isProcessing?: boolean;
}

interface ChatStore {
  messages: Message[];
  isRecording: boolean;
  isProcessing: boolean;
  addMessage: (message: Message) => void;
  setRecording: (isRecording: boolean) => void;
  setProcessing: (isProcessing: boolean) => void;
  updateLastMessage: (content: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isRecording: false,
  isProcessing: false,
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  setRecording: (isRecording) => set({ isRecording }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  updateLastMessage: (content) =>
    set((state) => ({
      messages: state.messages.map((msg, idx) =>
        idx === state.messages.length - 1
          ? { ...msg, content, isProcessing: false }
          : msg
      ),
    })),
}));
