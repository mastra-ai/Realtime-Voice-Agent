import { ElevenLabsTTS } from "@mastra/speech-elevenlabs";

export class TTSService {
  private tts: ElevenLabsTTS;
  private voiceId: string | null = null;

  constructor() {
    this.tts = new ElevenLabsTTS({
      model: {
        name: "eleven_multilingual_v2",
        apiKey: process.env.ELEVENLABS_API_KEY!,
      },
    });
  }

  async initialize() {
    const voices = await this.tts.voices();
    this.voiceId = voices?.[0]?.voice_id ?? null;
    if (!this.voiceId) {
      throw new Error("No voices available");
    }
  }

  async streamAudio(text: string) {
    if (!this.voiceId) {
      await this.initialize();
    }

    const { audioResult } = await this.tts.stream({
      text,
      voice: this.voiceId!,
    });

    return audioResult;
  }
}
