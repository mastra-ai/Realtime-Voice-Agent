import { Agent } from "@mastra/core/agent";

export const chatAgent = new Agent({
  name: "voice-chat-agent",
  instructions: 
    "You are a helpful and friendly AI assistant that engages in natural conversation. " +
    "You provide clear, concise responses while maintaining a conversational tone. " +
    "Keep responses brief and engaging, ideal for voice interactions.",
  model: {
    provider: "GOOGLE",
    name: "gemini-1.5-flash",
    toolChoice: "auto",
    apiKey: process.env.GOOGLE_API_KEY, 
  },
});
