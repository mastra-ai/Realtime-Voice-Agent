'use client';

// Add WebKit types
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    webkitAudioContext: typeof AudioContext;
  }
}

export interface ISpeechRecognitionService {
  startListening: (
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onVolumeChange?: (volume: number) => void,
    onSilence?: () => void,
    deviceId?: string
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
  let lastProcessedTime = 0;
  const SILENCE_THRESHOLD = 2000;
  const DUPLICATE_THRESHOLD = 1000;

  function initialize() {
    if (typeof window === 'undefined') {
      throw new Error('Speech recognition only works in browser');
    }

    const SpeechRecognitionConstructor = 
      window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionConstructor) {
      throw new Error('Speech recognition not supported in this browser');
    }

    if (recognition) {
      try {
        recognition.abort();
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
      } catch (e) {
        console.error('Error stopping existing recognition:', e);
      }
    }

    recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    return recognition;
  }

  async function setupAudioAnalysis(
    onVolumeChange?: (volume: number) => void, 
    onSilence?: () => void,
    deviceId?: string
  ) {
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        audio: deviceId 
          ? { deviceId: { exact: deviceId } }
          : true
      };
      
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (audioContext) {
        audioContext.close();
      }

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;

      function checkVolume() {
        if (!analyser || !isListening) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;

        if (onVolumeChange) {
          onVolumeChange(volume);
        }

        if (volume < 5) {
          if (!silenceStart) {
            silenceStart = Date.now();
          } else if (Date.now() - silenceStart >= SILENCE_THRESHOLD) {
            if (onSilence && currentTranscript.trim() && 
                Date.now() - lastProcessedTime >= DUPLICATE_THRESHOLD) {
              onSilence();
              silenceStart = null;
              currentTranscript = '';
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
      throw error;
    }
  }

  return {
    startListening: async (onResult, onError, onVolumeChange, onSilence, deviceId) => {
      try {
        // Stop any existing recognition
        if (recognition) {
          recognition.stop();
        }

        // Initialize new recognition
        recognition = initialize();
        currentTranscript = '';
        silenceStart = null;
        lastProcessedTime = 0;
        isListening = true;

        recognition.onresult = (event) => {
          const result = event.results[event.results.length - 1];
          const transcript = result[0].transcript.trim();
          const isFinal = result.isFinal;

          if (transcript) {
            if (isFinal) {
              if (Date.now() - lastProcessedTime >= DUPLICATE_THRESHOLD) {
                onResult(transcript, true);
                lastProcessedTime = Date.now();
                currentTranscript = '';
                silenceStart = null;
              }
            } else {
              currentTranscript = transcript;
            }
          }
        };

        recognition.onerror = (event) => {
          // Only log errors that aren't from normal operation
          if (event.error !== 'aborted' && event.error !== 'no-speech') {
            console.error('Speech recognition error:', event.error);
          }
          
          switch (event.error) {
            case 'not-allowed':
              onError('Microphone access denied. Please grant permission to use the microphone.');
              isListening = false;
              break;
            case 'network':
              onError('Network error occurred. Please check your internet connection.');
              break;
            case 'no-speech':
            case 'aborted':
              // Don't treat these as errors, they're part of normal operation
              break;
            default:
              if (event.error !== 'aborted') {
                onError(`Recognition error: ${event.error}`);
              }
          }
        };

        recognition.onend = () => {
          if (isListening) {
            try {
              // Don't reinitialize, just restart if we're still supposed to be listening
              recognition?.start();
            } catch (e) {
              console.error('Error restarting recognition:', e);
              isListening = false;
              onError('Failed to restart recognition');
            }
          }
        };

        await setupAudioAnalysis(onVolumeChange, () => {
          if (currentTranscript.trim() && 
              Date.now() - lastProcessedTime >= DUPLICATE_THRESHOLD) {
            if (onSilence) {
              onSilence();
              silenceStart = null;
              currentTranscript = '';
            }
          }
        }, deviceId);

        recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        isListening = false;
        if (error instanceof Error) {
          onError(error.message.includes('permission') 
            ? 'Please grant microphone permission to use voice input' 
            : error.message);
        } else {
          onError('Failed to start voice recognition');
        }
      }
    },

    stopListening: () => {
      try {
        isListening = false;

        if (recognition) {
          recognition.onend = null;
          recognition.abort();
          recognition = null;
        }

        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }

        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }

        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
          silenceTimeout = null;
        }

        currentTranscript = '';
        silenceStart = null;
        lastProcessedTime = 0;
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    },

    isSupported: () => {
      try {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      } catch {
        return false;
      }
    }
  };
}