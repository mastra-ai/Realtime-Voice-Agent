import { ElevenLabsTTS } from "@mastra/speech-elevenlabs";

function createTTSService() {
  
  let tts: ElevenLabsTTS | null = null;
  let voiceId: string | null = null;

  // Initialize TTS service
  async function initialize() {
    if (!tts) {
      tts = new ElevenLabsTTS({
        model: {
          name: "eleven_multilingual_v2",
          apiKey: process.env.ELEVENLABS_API_KEY!,
        },
      });
    }

    
    if (!voiceId) {
      const voices = await tts.voices();
      voiceId = voices?.[0]?.voice_id ?? null;
      
      if (!voiceId) {
        throw new Error("No voices available");
      }
    }
  }

  // Stream audio
  async function streamAudio(text: string) {
    
    await initialize();

    if (!tts || !voiceId) {
      throw new Error("TTS service not properly initialized");
    }

    const { audioResult } = await tts.stream({
      text,
      voice: voiceId,
    });

    return audioResult;
  }


  return {
    initialize,
    streamAudio
  };
}

export default createTTSService;