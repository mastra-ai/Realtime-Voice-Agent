export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isSupported: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.isSupported = true;
        this.configureRecognition();
      }
    }
  }

  private configureRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
  }

  startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ) {
    if (!this.isSupported) {
      onError('Speech recognition is not supported in this browser');
      return;
    }

    this.recognition!.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      const isFinal = event.results[0].isFinal;
      onResult(transcript, isFinal);
    };

    this.recognition!.onerror = (event) => {
      onError(event.error);
    };

    this.recognition!.start();
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  checkSupport(): boolean {
    return this.isSupported;
  }
}
