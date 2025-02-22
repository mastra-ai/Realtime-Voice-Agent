'use client';

/**
 * Global interface for the window object to include webkitSpeechRecognition and webkitAudioContext.
 */
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    webkitAudioContext: typeof AudioContext;
  }
}

/**
 * Interface for the SpeechRecognitionService.
 */
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

/**
 * SpeechRecognitionService class.
 */
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
  let baselineVolume = 0;
  const SILENCE_THRESHOLD = 1500; 
  const DUPLICATE_THRESHOLD = 800;
  const CALIBRATION_DURATION = 1000;
  const MIN_VOLUME_THRESHOLD = 3; 
  const VOLUME_MULTIPLIER = 1.5; 
  const REINIT_INTERVAL = 30000; 
  let lastInitTime = 0;

  /**
   * Initialize the speech recognition.
   */
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

  /**
   * Set up audio analysis.
   * @param onVolumeChange - callback for volume change
   * @param onSilence - callback for silence
   * @param deviceId - device ID
   */
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
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // advanced constraints for better sensitivity
          advanced: [{
            autoGainControl: {
              ideal: true,
              exact: true
            },
            channelCount: {
              ideal: 1
            },
            sampleRate: {
              ideal: 48000
            },
            sampleSize: {
              ideal: 16
            }
          }]
        }
      };
      
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (audioContext) {
        audioContext.close();
      }

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(mediaStream);

      // Add a gain node to amplify the audio
      const gainNode = audioContext.createGain();
      gainNode.gain.value = VOLUME_MULTIPLIER;
      
      source.connect(gainNode);
      gainNode.connect(analyser);
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.1; 
      analyser.minDecibels = -90; // Increased sensitivity to quiet sounds
      analyser.maxDecibels = -10; // Adjusted for better dynamic range

      // Calibrate baseline volume
      await calibrateBaselineVolume();

      function checkVolume() {
        if (!analyser || !isListening) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate volume with emphasis on quieter sounds
        const volume = Math.pow(dataArray.reduce((a, b) => a + b) / dataArray.length, 0.7);

        if (onVolumeChange) {
          onVolumeChange(volume);
        }

        // Use more sensitive threshold
        const dynamicThreshold = Math.max(MIN_VOLUME_THRESHOLD, baselineVolume * 0.8);

        if (volume < dynamicThreshold) {
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

  /**
   * Calibrate baseline volume.
   */
  async function calibrateBaselineVolume(): Promise<void> {
    if (!analyser) return;

    return new Promise((resolve) => {
      const samples: number[] = [];
      let startTime = Date.now();

      function sampleVolume() {
        if (!analyser) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        // Use the same volume calculation as in checkVolume
        const volume = Math.pow(dataArray.reduce((a, b) => a + b) / dataArray.length, 0.7);
        samples.push(volume);

        if (Date.now() - startTime < CALIBRATION_DURATION) {
          requestAnimationFrame(sampleVolume);
        } else {
          // Calculate baseline using a lower percentile for better sensitivity
          samples.sort((a, b) => a - b);
          const lowerQuartileIndex = Math.floor(samples.length * 0.15); // Using 15th percentile
          const lowerQuartileSamples = samples.slice(0, lowerQuartileIndex);
          baselineVolume = Math.max(
            MIN_VOLUME_THRESHOLD,
            lowerQuartileSamples.reduce((a, b) => a + b, 0) / lowerQuartileSamples.length
          );
          resolve();
        }
      }

      requestAnimationFrame(sampleVolume);
    });
  }

  async function forceReinitialize() {
    try {
      // Stop current recognition
      if (recognition) {
        recognition.onend = null; // Prevent auto-restart
        recognition.abort();
        recognition = null;
      }

      // Clean up audio context
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
          track.stop();
        });
        mediaStream = null;
      }

      if (audioContext?.state !== 'closed') {
        await audioContext?.close();
      }
      audioContext = null;
      analyser = null;

      // Reset all state
      currentTranscript = '';
      silenceStart = null;
      lastProcessedTime = 0;
      baselineVolume = 0;
      
      // Update last init time
      lastInitTime = Date.now();

      return initialize();
    } catch (error) {
      console.error('Error during reinitialization:', error);
      throw error;
    }
  }

  /**
   * Start listening.
   * @param onResult - callback for result
   * @param onError - callback for error
   * @param onVolumeChange - callback for volume change
   * @param onSilence - callback for silence
   * @param deviceId - device ID
   */
  return {
    startListening: async (onResult, onError, onVolumeChange, onSilence, deviceId) => {
      try {
        // Check if we need to reinitialize
        if (Date.now() - lastInitTime > REINIT_INTERVAL) {
          console.log('Performing periodic reinitialization');
          recognition = await forceReinitialize();
        } else if (!recognition) {
          recognition = initialize();
          lastInitTime = Date.now();
        }

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

        recognition.onerror = async (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          
          // For any error, try to reinitialize
          if (event.error !== 'no-speech') {
            try {
              recognition = await forceReinitialize();
              recognition.start();
              return;
            } catch (reinitError) {
              console.error('Reinitialization failed:', reinitError);
              onError('Recognition error occurred. Please refresh the page.');
              isListening = false;
            }
          }
        };

        recognition.onend = () => {
          if (isListening) {
            try {
              // Check if we need to reinitialize before restarting
              if (Date.now() - lastInitTime > REINIT_INTERVAL) {
                forceReinitialize().then(newRecognition => {
                  recognition = newRecognition;
                  recognition.start();
                });
              } else {
                recognition?.start();
              }
            } catch (e) {
              console.error('Error restarting recognition:', e);
              isListening = false;
              onError('Failed to restart recognition');
            }
          }
        };

        await setupAudioAnalysis(onVolumeChange, onSilence, deviceId);
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

    stopListening: async () => {
      try {
        isListening = false;

        if (recognition) {
          recognition.onend = null;
          recognition.abort();
          recognition = null;
        }

        if (mediaStream) {
          mediaStream.getTracks().forEach(track => {
            track.stop();
          });
          mediaStream = null;
        }

        if (audioContext?.state !== 'closed') {
          await audioContext?.close();
        }
        audioContext = null;
        analyser = null;

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