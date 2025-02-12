'use client';

export interface ISpeechRecognitionService {
  startListening: (
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onVolumeChange?: (volume: number) => void,
    onSilence?: () => void
  ) => void;
  stopListening: () => void;
  isSupported: () => boolean;
}

export function SpeechRecognitionService(): ISpeechRecognitionService {
  let recognition: SpeechRecognition | null = null;
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let silenceTimeout: NodeJS.Timeout | null = null;
  let isListening = false;

  function initialize() {
    if (typeof window === 'undefined') {
      throw new Error('Speech recognition only works in browser');
    }

    const SpeechRecognitionConstructor = 
      window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionConstructor) {
      throw new Error('Speech recognition not supported');
    }

    // Stop any existing recognition before creating a new one
    if (recognition) {
      recognition.stop();
    }

    recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    return recognition;
  }

  async function setupAudioAnalysis(onVolumeChange?: (volume: number) => void, onSilence?: () => void) {
    try {
      // Stop and clean up existing media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }

      // Create new media stream
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Close existing audio context if any
      if (audioContext) {
        audioContext.close();
      }

      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      analyser.fftSize = 2048;

      // Volume monitoring
      function checkVolume() {
        if (!analyser) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;

        if (onVolumeChange) {
          onVolumeChange(volume);
        }

        // Silence detection
        if (volume < 10) {
          if (!silenceTimeout && onSilence) {
            silenceTimeout = setTimeout(() => {
              onSilence();
              silenceTimeout = null;
            }, 1500);
          }
        } else if (silenceTimeout) {
          clearTimeout(silenceTimeout);
          silenceTimeout = null;
        }

        requestAnimationFrame(checkVolume);
      }

      requestAnimationFrame(checkVolume);
    } catch (error) {
      console.error('Audio analysis setup failed:', error);
    }
  }

  return {
    startListening: (onResult, onError, onVolumeChange, onSilence) => {
      try {
        // Prevent multiple start calls
        if (isListening) {
          console.warn('Speech recognition is already running. Stopping previous instance.');
          recognition?.stop();
        }

        // Initialize or reset recognition
        recognition = initialize();

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          
          const isFinal = event.results[0].isFinal;
          onResult(transcript, isFinal);
        };

        recognition.onerror = (event) => {
          onError(event.error);
          
          // Reset listening state
          isListening = false;
        };

        // Setup audio analysis
        setupAudioAnalysis(onVolumeChange, onSilence);

        // Start recognition
        recognition.start();
        isListening = true;
      } catch (error) {
        isListening = false;
        onError(error instanceof Error ? error.message : 'Unknown error');
      }
    },

    stopListening: () => {
      try {
        if (recognition) {
          recognition.stop();
        }
        
        // Clean up media stream
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }

        // Close audio context
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }

        // Clear silence timeout
        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
          silenceTimeout = null;
        }

        // Reset listening state
        isListening = false;
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    },

    isSupported: () => {
      return typeof window !== 'undefined' && 
             !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
  };
}