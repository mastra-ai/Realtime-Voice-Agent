import { motion } from 'framer-motion';
import React from 'react';

interface FuturisticMessageProps {
  isAI?: boolean;
  content?: string;
  avatar?: string;
  timestamp?: string;
  message?: {
    role: string;
    content: string;
  };
}

export function AiMessage({ isAI, content, avatar, timestamp, message }: FuturisticMessageProps) {
  const chatLogo = '/images/V-logo.jpeg';

  const messageContent = message?.content || content;
  const isAssistant = message?.role === 'assistant' || isAI;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-1.5`}
    >
      <div className={`flex ${isAssistant ? 'flex-row' : 'flex-row-reverse'} items-start max-w-[85%] group`}>
        {isAssistant && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden mr-2">
            {avatar ? (
              <img 
                src={avatar} 
                alt="AI Avatar" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2Njc3ODEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCI+PC9jaXJjbGU+PHBhdGggZD0iTTggOWg4IHY3YTIgMiAwIDAgMS0yIDJoLTRhMiAyIDAgMCAxLTItMlY5Ij48L3BhdGg+PHBhdGggZD0iTTEyIDN2NiI+PC9wYXRoPjwvc3ZnPg==';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-wa-light">
                <img src={chatLogo} alt="Chat Icon" className="text-wa-icon text-sm" />
              </div>
            )}
          </div>
        )}
        <div
          className={`relative px-3 py-2 rounded-lg shadow-wa ${
            isAssistant 
              ? 'bg-wa-incoming rounded-tl-none' 
              : 'bg-wa-outgoing rounded-tr-none'
          }`}
        >
          <div className="relative z-10">
            <p className="text-[0.9375rem] text-wa-text whitespace-pre-wrap">{messageContent}</p>
            {timestamp && (
              <span className="text-[0.6875rem] text-wa-secondary float-right ml-2 mt-1">
                {timestamp}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
