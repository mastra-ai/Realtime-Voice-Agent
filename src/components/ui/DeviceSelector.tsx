'use client';

import { useEffect, useState, useRef } from 'react';
import { BsMicFill } from 'react-icons/bs';
import { IoCheckmark } from 'react-icons/io5';

interface DeviceSelectorProps {
  onDeviceSelect: (deviceId: string) => void;
  selectedDeviceId?: string;
}

export function DeviceSelector({ onDeviceSelect, selectedDeviceId }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getDevices = async () => {
    try {
      // Only request microphone access when the dropdown is opened
      if (devices.length === 0) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = deviceList.filter(device => device.kind === 'audioinput');
      setDevices(audioInputDevices);
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  useEffect(() => {
    // Only add the devicechange listener, don't request access yet
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };

  const handleSelect = (deviceId: string) => {
    onDeviceSelect(deviceId);
    handleClose();
  };

  const handleOpen = async () => {
    if (!isOpen) {
      await getDevices(); // Get devices when opening the dropdown
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="text-white/80 hover:text-white transition-colors p-2"
        title="Select Microphone"
      >
        <BsMicFill className="w-5 h-5" />
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
              <BsMicFill className="w-4 h-4 text-[#128C7E]" />
              <span className="text-[#075E54]">Select Microphone</span>
            </div>
          </div>
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto py-2">
            {devices.map((device) => (
              <button
                key={device.deviceId}
                className={`w-full px-6 py-3.5 text-left text-sm transition-colors duration-200
                  ${device.deviceId === selectedDeviceId 
                    ? 'bg-[#DCF8C6]/30 text-[#075E54]' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }`}
                onClick={() => handleSelect(device.deviceId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <BsMicFill className={`w-4 h-4 ${
                      device.deviceId === selectedDeviceId 
                        ? 'text-[#128C7E]' 
                        : 'text-gray-500'
                    }`} />
                    <span className="font-medium">{device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}</span>
                  </div>
                  {device.deviceId === selectedDeviceId && (
                    <IoCheckmark className="w-5 h-5 text-[#128C7E]" />
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
