'use client';

import { useEffect, useRef, useState } from 'react';
import { SpeechRecognitionService } from '@/mastra/services/speechRecognition';
import { useChatStore } from '@/store/chatStore';
import { FaMicrophone, FaStop } from 'react-icons/fa';

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

  const [speechService] = useState(() => new SpeechRecognitionService());
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(0);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!speechService.checkSupport()) {
      setError('Speech recognition is not supported in your browser');
      return;
    }

    setIsContinuous(true);
    setRecording(true);
    setError(null);
    startListeningCycle();
  };

  const startListeningCycle = () => {
    // Don't start listening if AI is speaking
    if (isAISpeaking) return;

    speechService.startListening(
      (transcript, isFinal) => {
        if (isFinal && transcript.trim()) { // Only process non-empty transcripts
          handleSendMessage(transcript);
        }
      },
      (error) => {
        console.error('Speech recognition error:', error);
        setRecording(false);
        setError(`Speech recognition error: ${error}`);
      },
      (newVolume) => {
        setVolume(newVolume);
      },
      () => {
        // Silence detected
        if (isContinuous && !isAISpeaking) {
          startListeningCycle();
        }
      }
    );
  };

  const handleStopRecording = () => {
    setIsContinuous(false);
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    speechService.stopListening();
    setRecording(false);
    setVolume(0);
  };

  const handleSendMessage = async (message: string) => {
    // Stop listening while processing and during AI response
    speechService.stopListening();
    setRecording(false);
    
    addMessage({ role: 'user', content: message });
    setProcessing(true);
    setError(null);

    try {
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
            // Add a delay before resuming listening to avoid picking up audio tail
            restartTimeoutRef.current = setTimeout(() => {
              if (isContinuous) {
                setRecording(true);
                startListeningCycle();
              }
            }, 1000); // 1 second delay
          }
        };

        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          setIsAISpeaking(false);
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : String(error));
      addMessage({ 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      });
    } finally {
      setProcessing(false);
      if (!isAISpeaking && isContinuous) {
        setRecording(true);
        startListeningCycle();
      }
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

  return (
    <div className="flex flex-col h-screen bg-[#efeae2] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-[#075e54] dark:bg-gray-800 text-white p-4 flex items-center">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Mastra AI Assistant</h1>
          <div className="flex items-center text-sm opacity-75 space-x-2">
            {isProcessing && <p>Processing...</p>}
            {isAISpeaking && <p>AI Speaking...</p>}
            {isRecording && !isAISpeaking && (
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-white rounded-full transition-all duration-200"
                      style={{
                        height: Math.min(4 + (volume / 25) * i, 16),
                        opacity: 0.3 + (volume / 255) * 0.7
                      }}
                    />
                  ))}
                </div>
                <p>Listening{isContinuous ? ' (Continuous)' : ''}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-2" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg p-3 relative message-bubble ${
                message.role === 'user'
                  ? 'bg-[#dcf8c6] dark:bg-green-700 ml-12 user'
                  : 'bg-white dark:bg-gray-700 mr-12 assistant'
              }`}
            >
              <p className={`text-[#303030] dark:text-white mb-1 ${
                message.role === 'user' ? 'text-left' : 'text-left'
              }`}>
                {message.content}
              </p>
              <span className={`text-xs text-gray-500 dark:text-gray-400 block mt-1`}>
                {formatTime()}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Recording Button */}
      <div className="bg-[#f0f0f0] dark:bg-gray-800 p-4">
        <div className="flex justify-center items-center">
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`p-4 rounded-full shadow-lg transition-all duration-200 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 scale-110'
                : 'bg-[#075e54] hover:bg-[#064c44]'
            } ${(isProcessing || isAISpeaking) ? 'opacity-50 cursor-not-allowed' : ''} relative`}
            disabled={isProcessing || isAISpeaking}
          >
            {isRecording ? (
              <FaStop className="text-white text-xl" />
            ) : (
              <FaMicrophone className="text-white text-xl" />
            )}
            {isRecording && !isAISpeaking && (
              <div className="absolute -top-1 -right-1 w-3 h-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </div>
            )}
          </button>
        </div>
        {isProcessing && (
          <div className="text-center mt-2 text-sm text-gray-500 dark:text-gray-400">
            Processing your message...
          </div>
        )}
      </div>
    </div>
  );
}
