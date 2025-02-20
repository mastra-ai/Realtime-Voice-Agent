import { ElevenLabsTTS } from "@mastra/speech-elevenlabs";

function createTTSService() {
  
  let tts: ElevenLabsTTS | null = null;
  let voiceId: string | null = "TxGEqnHWrfWFTfGW9XjX"; // Default to charlie's voice

  // Initialize TTS service
  async function initialize(selectedVoiceId?: string) {
    if (!tts) {
      tts = new ElevenLabsTTS({
        model: {
          name: "eleven_flash_v2_5",
          apiKey: process.env.ELEVENLABS_API_KEY!,
        },
      });
    }

    if (selectedVoiceId) {
      voiceId = selectedVoiceId;
    }
  }

  // Stream audio
  async function streamAudio(text: string, selectedVoiceId?: string) {
    
    await initialize(selectedVoiceId);

    if (!tts || !voiceId) {
      throw new Error("TTS service not properly initialized");
    }

    const { audioResult } = await tts.stream({
      text,
      voice: voiceId
    });

    return audioResult;
  }

  // Get available voices
  async function getVoices() {
    await initialize();
    if (!tts) {
      throw new Error("TTS service not properly initialized");
    }
    return await tts.voices();
  }

  return {
    initialize,
    streamAudio,
    getVoices
  };
}

export default createTTSService;