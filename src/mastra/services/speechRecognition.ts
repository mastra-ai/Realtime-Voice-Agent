export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isSupported: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private readonly SILENCE_THRESHOLD = -65; // dB
  private readonly SILENCE_DURATION = 2000; // ms

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

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
  }

  private async setupAudioAnalysis() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      this.analyser.fftSize = 2048;
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  }

  private getVolume(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    return average;
  }

  startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onVolumeChange?: (volume: number) => void,
    onSilence?: () => void,
  ) {
    if (!this.isSupported) {
      onError('Speech recognition is not supported in this browser');
      return;
    }

    // Setup audio analysis for volume detection
    this.setupAudioAnalysis();

    // Start volume monitoring
    if (onVolumeChange) {
      const monitorVolume = () => {
        const volume = this.getVolume();
        onVolumeChange(volume);

        // Check for silence
        if (volume < this.SILENCE_THRESHOLD) {
          if (!this.silenceTimeout && onSilence) {
            this.silenceTimeout = setTimeout(() => {
              onSilence();
              this.silenceTimeout = null;
            }, this.SILENCE_DURATION);
          }
        } else if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }

        requestAnimationFrame(monitorVolume);
      };
      requestAnimationFrame(monitorVolume);
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

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  checkSupport(): boolean {
    return this.isSupported;
  }
}
