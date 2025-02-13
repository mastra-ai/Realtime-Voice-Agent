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
  let currentTranscript = '';
  let silenceStart: number | null = null;
  const SILENCE_THRESHOLD = 2000; 

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

        // Silence detection with threshold
        if (volume < 10) {
          if (!silenceStart) {
            silenceStart = Date.now();
          } else if (Date.now() - silenceStart >= SILENCE_THRESHOLD) {
            if (onSilence && currentTranscript.trim()) {
              onSilence();
              silenceStart = null;
            }
          }
        } else {
          silenceStart = null;
        }

        if (isListening) {
          requestAnimationFrame(checkVolume);
        }
      }

      requestAnimationFrame(checkVolume);
    } catch (error) {
      console.error('Audio analysis setup failed:', error);
    }
  }

  return {
    startListening: (onResult, onError, onVolumeChange, onSilence) => {
      try {
        // Initialize or reset recognition
        recognition = initialize();
        currentTranscript = '';
        silenceStart = null;

        recognition.onresult = (event) => {
          // Get only the latest result
          const currentResult = event.results[event.results.length - 1];
          const transcript = currentResult[0].transcript;
          const isFinal = currentResult.isFinal;
          
          if (isFinal) {
            currentTranscript = transcript.trim();
            // Only send result if we've detected sufficient silence
            if (silenceStart && Date.now() - silenceStart >= SILENCE_THRESHOLD) {
              onResult(currentTranscript, true);
              currentTranscript = '';
              silenceStart = null;
            }
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          onError(event.error);
        
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');

          if (isListening) {
            try {
              recognition?.start();
            } catch (e) {
              console.error('Error restarting recognition:', e);
              isListening = false;
              onError('Failed to restart recognition');
            }
          }
        };

        // Setup audio analysis
        setupAudioAnalysis(onVolumeChange, () => {
          // Only trigger silence callback if we have content
          if (currentTranscript.trim()) {
            onResult(currentTranscript.trim(), true);
            currentTranscript = '';
            silenceStart = null;
            if (onSilence) onSilence();
          }
        });

        // Start recognition
        recognition.start();
        isListening = true;
      } catch (error) {
        console.error('Error starting recognition:', error);
        isListening = false;
        onError(error instanceof Error ? error.message : 'Unknown error');
      }
    },

    stopListening: () => {
      try {
        isListening = false; 
        
        if (recognition) {
          recognition.onend = null; 
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