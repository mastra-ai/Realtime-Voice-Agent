'use client';

import { useEffect, useRef, useState } from 'react';
import { SpeechRecognitionService } from '@/mastra/services/speechRecognition';
import { useChatStore } from '@/store/chatStore';
import { AiMessage } from './ui/AiMessage';
import { motion } from 'framer-motion';
import { DeviceSelector } from './ui/DeviceSelector';
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

  useEffect(() => {
    // Load saved device preference
    const savedDeviceId = localStorage.getItem('preferredAudioDevice');
    if (savedDeviceId) {
      setSelectedDeviceId(savedDeviceId);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  const handleStartRecording = () => {
    if (!speechService.isSupported()) {
      setError('Speech recognition is not supported in your browser');
      return;
    }

    // Reset states
    setIsContinuous(true);
    setRecording(true);
    setError(null);
    setRetryCount(0);

    // Start fresh listening cycle
    startListeningCycle();
  };

  const startListeningCycle = () => {
    if (isAISpeaking) return;

    speechService.startListening(
      (transcript, isFinal) => {
        if (isFinal && transcript.trim()) { 
          handleSendMessage(transcript);
        }
      },
      (error) => {
        console.error('Speech recognition error:', error);
        setRecording(false);
        
        // Attempt to restart on error if in continuous mode
        if (isContinuous && !isAISpeaking && retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          restartTimeoutRef.current = setTimeout(() => {
            if (isContinuous) {
              setRecording(true);
              startListeningCycle();
            }
          }, 1000);
        }
      },
      (newVolume) => {
        setVolume(newVolume);
      },
      () => {
        // Silence detected - only restart if we're still in continuous mode
        if (isContinuous && !isAISpeaking) {
          startListeningCycle();
        }
      },
      selectedDeviceId
    );
  };

  const handleSendMessage = async (message: string) => {
    try {
      addMessage({ role: 'user', content: message });
      setProcessing(true);
      setError(null);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Unknown error occurred');
      }

      addMessage({ role: 'assistant', content: data.text });

      if (data.audio) {
        setIsAISpeaking(true);
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        
        audio.onended = () => {
          setIsAISpeaking(false);
          if (isContinuous) {
            // Resume listening after AI finishes speaking
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
        // If no audio response, continue listening immediately
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
      
      // Continue listening even after error
      if (isContinuous) {
        setRecording(true);
        startListeningCycle();
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleStopRecording = () => {
    setIsContinuous(false);
    setRecording(false);
    setVolume(0);
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    speechService.stopListening();
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

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-wa-header relative z-20 shadow-header">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-white/10">
              <div className="w-full h-full flex items-center justify-center">
                <img src={AILogo} alt="App Logo" className="w-full h-full" />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-white text-lg font-semibold">Mastra Voice AI</h1>
              <div className="text-white/70 text-sm flex items-center">
                {isProcessing ? (
                  <span className="animate-pulse-gentle">Processing...</span>
                ) : isAISpeaking ? (
                  <span className="animate-pulse-gentle">Speaking...</span>
                ) : isRecording ? (
                  <span className="animate-pulse-gentle">Listening...</span>
                ) : (
                  <span>Online</span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <DeviceSelector
                selectedDeviceId={selectedDeviceId}
                onDeviceSelect={handleDeviceSelect}
              />
              <button className="text-white/80 hover:text-white transition-colors p-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-wa-red/10 border-l-4 border-wa-red text-wa-red mx-4 mt-2 p-2 text-sm"
          role="alert"
        >
          <p>{error}</p>
        </motion.div>
      )}

      {/* Chat Messages */}
      <div 
        className="flex-grow overflow-y-auto p-4 space-y-4"
        style={{ 
          background: `
            linear-gradient(0deg, rgba(229, 221, 213, 0.95), rgba(229, 221, 213, 0.95)),
            url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h100v100H0z' fill='%23128C7E' fill-opacity='0.05'/%3E%3Cpath d='M10 10h10v10H10zM30 10h10v10H30zM50 10h10v10H50zM70 10h10v10H70zM20 20h10v10H20zM40 20h10v10H40zM60 20h10v10H60zM80 20h10v10H80zM10 30h10v10H10z' fill='%23075E54' fill-opacity='0.05'/%3E%3C/svg%3E")
          `
        }}
      >
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && (
            <>
            <div className="flex flex-col items-center justify-center text-center space-y-4 mt-12">
                <div className="w-16 h-16 rounded-full bg-[#DCF8C6]/30 flex items-center justify-center">
                  <BsMicFill className="w-8 h-8 text-[#128C7E]" />
                </div>
                <div className="max-w-sm">
                  <h3 className="text-[#075E54] font-medium mb-2">Welcome to Mastra AI</h3>
                  <p className="text-sm text-gray-600">
                    Start a voice conversation by clicking the microphone button below. I'm here to assist you with anything you need.
                  </p>
                </div>
              </div>
            </>
          )}

          {messages.map((message, index) => (
            <AiMessage
              key={index}
              isAI={message.role === 'assistant'}
              content={message.content}
              avatar="/images/V-logo.jpeg"
              timestamp={formatTime()}
            />
          ))}
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
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Footer with Recording Button and Speaking Animation */}
      <div className="relative bg-gradient-to-b from-[#DCF8C6]/30 to-[#E8F8F5] border-t border-wa-border/30 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-center items-center">
            {/* Voice Modulation Wave */}
            {(isRecording || isAISpeaking) && (
              <div className="absolute inset-x-0 top-0 h-16 overflow-hidden">
                <div className="relative w-full h-full flex items-center">
                  {/* Main Wave Group */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Center Wave Bars */}
                    <div className="flex items-center space-x-[1px] h-full">
                      {[...Array(40)].map((_, i) => (
                        <motion.div
                          key={i}
                          className={`w-1.5 ${
                            isRecording 
                              ? 'bg-[#25D366]'
                              : 'bg-[#128C7E]'
                          }`}
                          style={{
                            boxShadow: isRecording
                              ? '0 0 8px rgba(37, 211, 102, 0.4)'
                              : '0 0 8px rgba(18, 140, 126, 0.4)'
                          }}
                          animate={{
                            height: [
                              '8px',
                              `${8 + Math.abs(Math.sin((i / 40) * Math.PI * 4)) * 24}px`,
                              '8px'
                            ],
                            opacity: [0.6, 1, 0.6]
                          }}
                          transition={{
                            duration: 0.75 + Math.random() * 0.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: -i * 0.02
                          }}
                        />
                      ))}
                    </div>

                    {/* Mirror Wave Bars */}
                    <div className="flex items-center space-x-[1px] h-full absolute">
                      {[...Array(40)].map((_, i) => (
                        <motion.div
                          key={`mirror-${i}`}
                          className={`w-1.5 ${
                            isRecording 
                              ? 'bg-[#25D366]'
                              : 'bg-[#128C7E]'
                          }`}
                          style={{
                            opacity: 0.3,
                            boxShadow: isRecording
                              ? '0 0 8px rgba(37, 211, 102, 0.2)'
                              : '0 0 8px rgba(18, 140, 126, 0.2)'
                          }}
                          animate={{
                            height: [
                              '8px',
                              `${8 + Math.abs(Math.cos((i / 40) * Math.PI * 4)) * 24}px`,
                              '8px'
                            ]
                          }}
                          transition={{
                            duration: 0.75 + Math.random() * 0.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: -i * 0.02
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
                          className={`w-1 h-1 rounded-full ${
                            isRecording 
                              ? 'bg-[#25D366]'
                              : 'bg-[#128C7E]'
                          }`}
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5]
                          }}
                          transition={{
                            duration: 0.5 + i * 0.1,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.1
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-center opacity-10 pointer-events-none">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={`grid-${i}`}
                        className={`w-full h-[1px] ${
                          isRecording 
                            ? 'bg-[#25D366]'
                            : 'bg-[#128C7E]'
                        }`}
                        style={{
                          transform: `translateY(${(i - 3.5) * 8}px)`
                        }}
                      />
                    ))}
                  </div>

                  {/* Glow Effects */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#DCF8C6]/40 pointer-events-none" />
                  <div className={`absolute inset-0 ${
                    isRecording 
                      ? 'bg-[#25D366]/5'
                      : 'bg-[#128C7E]/5'
                  } mix-blend-overlay pointer-events-none`} />
                </div>
              </div>
            )}

            <div className="relative w-16 h-16">
              {/* Main Button */}
              <motion.button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isProcessing || isAISpeaking}
                className={`w-full h-full rounded-full ${
                  isRecording 
                    ? 'bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#075E54] text-white' 
                    : 'bg-gradient-to-r from-[#128C7E] via-[#075E54] to-[#25D366] text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center`}
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <rect x="6" y="6" width="12" height="12" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  );
}
