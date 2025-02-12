import { motion } from 'framer-motion';
import React from 'react';

interface SpeechWaveProps {
  volume: number;  // 0-100
}

export function SpeechWave({ volume }: SpeechWaveProps) {
  const normalizedVolume = Math.min(100, Math.max(0, volume)) / 100;
  const numBars = 12;
  
  return (
    <div className="flex items-end justify-center space-x-1 h-24 overflow-hidden">
      {Array.from({ length: numBars }).map((_, i) => {
        const baseHeight = 30 + Math.sin((i / numBars) * Math.PI) * 40;
        const height = baseHeight * normalizedVolume;
        
        return (
          <motion.div
            key={i}
            className="w-1.5 bg-gradient-to-t from-neon-blue to-neon-purple rounded-full"
            animate={{
              height: [height * 0.7, height, height * 0.7],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
            style={{
              filter: 'blur(0.5px)',
              boxShadow: '0 0 8px rgba(0, 243, 255, 0.5)'
            }}
          />
        );
      })}
      <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
