'use client';

import { useEffect, useRef, useState } from 'react';
import { SpeechRecognitionService } from '@/mastra/services/speechRecognition';
import { useChatStore } from '@/store/chatStore';
import { AiMessage } from './ui/AiMessage';
import { motion } from 'framer-motion';
import { DeviceSelector } from './ui/DeviceSelector';
import { VoiceSelector } from './ui/VoiceSelector';
import { BsMicFill } from 'react-icons/bs';

export default function ChatInterface() {
  const {
    messages,
    isRecording,
    isProcessing,
    addMessage,
    setRecording,
    setProcessing,
    updateLastMessage,
  } = useChatStore();

  const [speechService] = useState(() => SpeechRecognitionService());
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(0);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>();

  useEffect(() => {
    // Load saved preferences
    const savedDeviceId = localStorage.getItem('preferredAudioDevice');
    const savedVoiceId = localStorage.getItem('preferredVoiceId');
    if (savedDeviceId) {
      setSelectedDeviceId(savedDeviceId);
    }
    if (savedVoiceId) {
      setSelectedVoiceId(savedVoiceId);
    }
  }, []);

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('preferredAudioDevice', deviceId);
    
    // Restart recording if currently active
    if (isRecording) {
      speechService.stopListening();
      startListeningCycle();
    }
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    localStorage.setItem('preferredVoiceId', voiceId);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const stopListening = async () => {
    try {
      console.log(`Stopping recognition`)
      setRecording(false);
      setIsContinuous(false);
      await speechService.stopListening();
      setError(null);
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  };

  const handleStartRecording = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!speechService.isSupported()) {
      setError('Speech recognition is not supported in your browser');
      return;
    }

    setIsContinuous(true);
    setRecording(true);
    setError(null);
    setRetryCount(0);
    startListeningCycle();
  };

  const startListeningCycle = () => {
    console.log(`Start listening cycle`, { isContinuous })
    if (isAISpeaking) return;

    try {
      // Reset error state before starting
      setError(null);
      
      speechService.startListening(
        (transcript, isFinal) => {
          if (isFinal && transcript.trim()) { 
            console.log(`Final transcript`, { isContinuous })
            handleSendMessage(transcript);
          }
        },
        (error) => {
          console.error('Speech recognition error:', error);
          
          if (error.includes('refresh')) {
            // Critical error - stop continuous mode
            setIsContinuous(false);
            setRecording(false);
          } else {
            // For non-critical errors, just show the error
            setError(error);
            
            // Auto-restart after a brief delay
            if (isContinuous && !isAISpeaking) {
              setTimeout(() => {
                if (isContinuous) {
                  setError(null);
                  setRecording(true);
                  startListeningCycle();
                }
              }, 1000);
            }
          }
        },
        (newVolume) => {
          setVolume(newVolume);
        },
        () => {
          if (isContinuous && !isAISpeaking) {
            startListeningCycle();
          }
        },
        selectedDeviceId
      );
    } catch (error) {
      console.error('Failed to start listening cycle:', error);
      setError('Failed to start voice recognition. Please refresh the page.');
      setIsContinuous(false);
      setRecording(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    try {
      setProcessing(true);
      console.log(`Sending message`, { isContinuous  });
      speechService.stopListening();
      setRecording(false);

      addMessage({ role: 'user', content: text });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: text,
          voiceId: selectedVoiceId
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      addMessage({ role: 'assistant', content: data.text });

      if (data.audio) {
        setIsAISpeaking(true);
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);

        audio.onplay = () => {
          setIsAISpeaking(true);
        };
        
        audio.onended = () => {
          setIsAISpeaking(false);
          if (isContinuous) {
            setRecording(true);
            startListeningCycle();
          }
        };

        await audio.play().catch(error => {
          console.error('Error playing audio:', error);
          setIsAISpeaking(false);
          if (isContinuous) {
            setRecording(true);
            startListeningCycle();
          }
        });
      } else {
        if (isContinuous) {
          setRecording(true);
          startListeningCycle();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : String(error));
      addMessage({ 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      });
      
      if (isContinuous) {
        setRecording(true);
        startListeningCycle();
      }
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const AILogo = '/images/V-logo.jpeg'; 

  useEffect(() => {
    if (isContinuous) {
      startListeningCycle();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [isContinuous]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Stars Background Layer - Fixed */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="stars-layer">
          <div className="stars-tiny"></div>
        </div>
        <div className="stars-layer">
          <div className="stars-small"></div>
        </div>
        <div className="stars-layer">
          <div className="stars-medium"></div>
        </div>
        <div className="stars-layer">
          <div className="stars-large"></div>
        </div>
      </div>

      {/* Content Layer - Fixed */}
      <div className="fixed inset-0 z-10">
        <div className="w-full h-full p-4 md:p-8 flex items-center justify-center">
          <div className="w-full max-w-4xl h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] bg-black/30 backdrop-blur-md rounded-3xl overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-black/40 via-[#042f2e]/60 to-black/40 backdrop-blur-xl relative z-20 px-6 py-4 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#128C7E] to-[#075E54] shadow-lg border border-white/20 p-0.5">
                  <div className="w-full h-full rounded-full overflow-hidden bg-black/20 backdrop-blur-sm">
                    <img src={AILogo} alt="App Logo" className="w-full h-full object-cover scale-110 hover:scale-125 transition-transform duration-300" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-white text-lg font-semibold truncate bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/80">Mastra Voice AI</h1>
                  <div className="text-white/80 text-sm flex items-center">
                    {isProcessing ? (
                      <span className="animate-pulse-gentle flex items-center space-x-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                        <span>Processing...</span>
                      </span>
                    ) : isAISpeaking ? (
                      <span className="animate-pulse-gentle flex items-center space-x-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        <span>Speaking...</span>
                      </span>
                    ) : isRecording ? (
                      <span className="animate-pulse-gentle flex items-center space-x-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        <span>Listening...</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Online</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <DeviceSelector
                    selectedDeviceId={selectedDeviceId}
                    onDeviceSelect={handleDeviceSelect}
                  />
                  <VoiceSelector
                    selectedVoiceId={selectedVoiceId || ''}
                    onVoiceSelect={handleVoiceSelect}
                  />
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-500/10 backdrop-blur-sm border-l-4 border-red-500 text-red-500 mx-4 mt-4 p-3 text-sm rounded-r-lg shadow-lg"
                role="alert"
              >
                <p>{error}</p>
              </motion.div>
            )}

            {/* Chat Messages */}
            <div 
              className="flex-grow overflow-y-auto p-6 space-y-4 overscroll-none"
              style={{ 
                background: `
                  linear-gradient(0deg, rgba(229, 221, 213, 0.97), rgba(229, 221, 213, 0.97))
                `
              }}
            >
              <div className="max-w-3xl mx-auto w-full">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center space-y-6 mt-12">
                    <div className="w-20 h-20 rounded-full bg-[#128C7E]/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-[#128C7E]/30">
                      <BsMicFill className="w-10 h-10 text-[#128C7E]" />
                    </div>
                    <div className="max-w-sm bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                      <h3 className="text-[#075E54] font-medium text-lg mb-2">Welcome to Mastra AI</h3>
                      <p className="text-gray-600">
                        Start a voice conversation by clicking the microphone button below. I'm here to assist you with anything you need.
                      </p>
                    </div>
                  </div>
                )}

                {/* Message List */}
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <AiMessage
                      key={index}
                      isAI={message.role === 'assistant'}
                      message={message}
                      avatar="/images/V-logo.jpeg"
                      timestamp={formatTime()}
                    />
                  ))}
                </div>
                
                {isProcessing && (
                  <div className="flex justify-start items-center space-x-2 p-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-wa-teal flex items-center justify-center">
                      <img src="/images/ai-avatar.svg" alt="AI" className="w-full h-full" />
                    </div>
                    <div className="flex space-x-1">
                      <motion.div
                        className="w-2 h-2 rounded-full bg-wa-teal"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 0,
                        }}
                      />
                      <motion.div
                        className="w-2 h-2 rounded-full bg-wa-teal"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 0.2,
                        }}
                      />
                      <motion.div
                        className="w-2 h-2 rounded-full bg-wa-teal"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 0.4,
                        }}
                      />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Footer with Recording Button and Voice Wave */}
            <div className="relative bg-[#042f2e]/90 backdrop-blur-md border-t border-white/10 shadow-lg">
              {/* Sound Wave Animation */}
              {(isRecording || isAISpeaking) && (
                <div className="absolute inset-x-0 top-0 h-16 overflow-hidden">
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Primary Wave */}
                    <div className="flex items-center space-x-[1px]">
                      {[...Array(32)].map((_, i) => (
                        <motion.div
                          key={i}
                          className={`w-1.5 rounded-full ${
                            isRecording 
                              ? 'bg-gradient-to-t from-[#25D366] to-[#128C7E]'
                              : 'bg-gradient-to-t from-[#128C7E] to-[#075E54]'
                          }`}
                          style={{
                            height: '8px',
                            boxShadow: isRecording
                              ? '0 0 8px rgba(37, 211, 102, 0.4)'
                              : '0 0 8px rgba(18, 140, 126, 0.4)'
                          }}
                          animate={{
                            height: [
                              '8px',
                              `${8 + Math.abs(Math.sin((i / 32 + Date.now() / 1000) * Math.PI * 2)) * 24}px`,
                              '8px'
                            ],
                            opacity: [0.6, 1, 0.6]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: -i * 0.05
                          }}
                        />
                      ))}
                    </div>

                    {/* Mirror Wave */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      <div className="flex items-center space-x-[1px]">
                        {[...Array(32)].map((_, i) => (
                          <motion.div
                            key={`mirror-${i}`}
                            className={`w-1.5 rounded-full ${
                              isRecording 
                                ? 'bg-gradient-to-b from-[#25D366] to-[#128C7E]'
                                : 'bg-gradient-to-b from-[#128C7E] to-[#075E54]'
                            }`}
                            style={{ height: '8px' }}
                            animate={{
                              height: [
                                '8px',
                                `${8 + Math.abs(Math.cos((i / 32 + Date.now() / 1000) * Math.PI * 2)) * 20}px`,
                                '8px'
                              ]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: -i * 0.03
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Frequency Dots */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex space-x-12">
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={`freq-${i}`}
                            className={`w-1.5 h-1.5 rounded-full ${
                              isRecording 
                                ? 'bg-[#25D366]'
                                : 'bg-[#128C7E]'
                            }`}
                            animate={{
                              scale: [1, 1.5, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 1 + i * 0.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: i * 0.1
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#DCF8C6]/20 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="max-w-4xl mx-auto px-6 py-6">
                <div className="flex justify-center items-center">
                  <motion.button
                    onClick={isRecording ? stopListening : handleStartRecording}
                    disabled={isProcessing || isAISpeaking}
                    className={`w-16 h-16 rounded-full ${
                      isRecording 
                        ? 'bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#075E54] text-white border-2 border-[#25D366]/30' 
                        : 'bg-gradient-to-r from-[#128C7E] via-[#075E54] to-[#25D366] text-white border-2 border-[#128C7E]/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center touch-manipulation backdrop-blur-sm`}
                    style={{
                      boxShadow: isRecording
                        ? '0 0 20px rgba(37, 211, 102, 0.3), 0 0 40px rgba(18, 140, 126, 0.2)'
                        : '0 0 20px rgba(18, 140, 126, 0.3), 0 0 40px rgba(7, 94, 84, 0.2)'
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="relative z-10">
                      {isRecording ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <rect x="6" y="6" width="12" height="12" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      )}
                    </div>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ambient glow effect */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#128C7E]/20 via-transparent to-[#075E54]/20 pointer-events-none" />

      <style jsx>{`
        .stars-layer {
          position: absolute;
          inset: -100% -100% -100% -100%;
          width: 300%;
          height: 300%;
          animation: rotate-layer 200s linear infinite;
          transform-origin: center center;
        }

        .stars-tiny,
        .stars-small,
        .stars-medium,
        .stars-large {
          position: absolute;
          inset: 0;
          background-repeat: repeat;
          will-change: transform;
        }
        
        .stars-tiny {
          background-image: 
            radial-gradient(1px 1px at 10% 10%, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 20% 20%, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 30% 30%, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 40% 40%, white, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 50% 50%, white, rgba(0,0,0,0));
          background-size: 200px 200px;
          opacity: 0.6;
          animation: twinkle 4s ease-in-out infinite;
        }

        .stars-small {
          background-image: 
            radial-gradient(1.5px 1.5px at 15% 15%, white, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 25% 25%, #fff, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 35% 35%, #fff, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 45% 45%, white, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 55% 55%, #ffd700, rgba(0,0,0,0));
          background-size: 300px 300px;
          opacity: 0.5;
          animation: twinkle 3s ease-in-out infinite;
        }

        .stars-medium {
          background-image: 
            radial-gradient(2px 2px at 60% 60%, #fff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 70% 70%, #ffd700, rgba(0,0,0,0)),
            radial-gradient(2.5px 2.5px at 80% 80%, #87ceeb, rgba(0,0,0,0)),
            radial-gradient(2.5px 2.5px at 90% 90%, #fff, rgba(0,0,0,0)),
            radial-gradient(2.5px 2.5px at 100% 100%, #ffd700, rgba(0,0,0,0));
          background-size: 400px 400px;
          opacity: 0.4;
          animation: twinkle 5s ease-in-out infinite;
        }

        .stars-large {
          background-image: 
            radial-gradient(3px 3px at 65% 65%, #fff, rgba(0,0,0,0)),
            radial-gradient(3px 3px at 75% 75%, #ffd700, rgba(0,0,0,0)),
            radial-gradient(3.5px 3.5px at 85% 85%, #87ceeb, rgba(0,0,0,0)),
            radial-gradient(3.5px 3.5px at 95% 95%, #fff, rgba(0,0,0,0)),
            radial-gradient(4px 4px at 100% 100%, #ffd700, rgba(0,0,0,0));
          background-size: 500px 500px;
          opacity: 0.3;
          animation: twinkle 6s ease-in-out infinite;
        }

        @keyframes rotate-layer {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 1; }
        }

        .stars-layer:nth-child(1) { animation-duration: 100s; }
        .stars-layer:nth-child(2) { animation-duration: 150s; }
        .stars-layer:nth-child(3) { animation-duration: 200s; }
        .stars-layer:nth-child(4) { animation-duration: 250s; }
      `}</style>
    </div>
  );
}
