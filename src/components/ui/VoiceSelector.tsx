import { useState, useEffect, useRef } from 'react';
import { RiUserVoiceFill } from "react-icons/ri";
import { IoCheckmark } from 'react-icons/io5';

interface Voice {
  voice_id: string;
  name: string;
  accent: string;
  description: string;
}

interface VoiceSelectorProps {
  onVoiceSelect: (voiceId: string) => void;
  selectedVoiceId: string;
}

// Prioritized male voices first
const predefinedVoices: Voice[] = [
  {
    voice_id: "IKne3meq5aSn9XLyUdCD",
    name: "Charlie",
    accent: "American",
    description: "Casual and conversational"
  },
  {
    voice_id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Michael",
    accent: "American",
    description: "Authoritative and professional"
  },
  {
    voice_id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    accent: "British",
    description: "Energetic and dynamic"
  },
  {
    voice_id: "yoZ06aMxZJJ28mfd3POQ",
    name: "James",
    accent: "Australian",
    description: "Confident and clear"
  },
  
  {
    voice_id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    accent: "British",
    description: "Professional and articulate"
  },
  {
    voice_id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    accent: "American",
    description: "Warm and friendly"
  },
  {
    voice_id: "ThT5KcBeYPX3keUQqHPh",
    name: "Emily",
    accent: "British",
    description: "Warm and professional"
  }
];

export function VoiceSelector({ onVoiceSelect, selectedVoiceId }: VoiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };

  const handleSelect = (voiceId: string) => {
    onVoiceSelect(voiceId);
    handleClose();
  };

  const handleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="text-white/80 hover:text-white transition-colors p-2"
        title="Select Voice"
      >
        <RiUserVoiceFill className="w-5 h-5" />
      </button>

      {(isOpen || isClosing) && (
        <div 
          className={`absolute right-0 mt-2 w-[320px] bg-white rounded-lg shadow-lg z-50 overflow-hidden
            transition-all duration-200 ease-in-out origin-top
            ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
          `}
        >
          <div className="px-6 py-4 text-sm font-medium border-b bg-[#DCF8C6]/30">
            <div className="flex items-center space-x-3">
              <RiUserVoiceFill className="w-4 h-4 text-[#128C7E]" />
              <span className="text-[#075E54]">Select Voice</span>
            </div>
          </div>
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto py-2">
            {predefinedVoices.map((voice) => (
              <button
                key={voice.voice_id}
                onClick={() => handleSelect(voice.voice_id)}
                className={`w-full px-6 py-4 text-left text-sm transition-colors duration-200
                  ${voice.voice_id === selectedVoiceId 
                    ? 'bg-[#DCF8C6]/30 text-[#075E54]' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <RiUserVoiceFill className={`w-4 h-4 ${
                    voice.voice_id === selectedVoiceId 
                      ? 'text-[#128C7E]' 
                      : 'text-gray-500'
                  }`} />
                  <div>
                    <div className="font-medium">{voice.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {voice.accent} · {voice.description}
                    </div>
                  </div>
                  {voice.voice_id === selectedVoiceId && (
                    <IoCheckmark className="w-5 h-5 text-[#128C7E] ml-auto" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
