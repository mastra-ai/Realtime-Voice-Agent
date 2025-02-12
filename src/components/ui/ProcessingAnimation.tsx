import { motion } from 'framer-motion';
import React from 'react';

export function ProcessingAnimation() {
  return (
    <div className="flex items-center space-x-2 p-4">
      <motion.div
        className="flex space-x-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-gradient-to-r from-neon-blue to-neon-purple"
            animate={{
              y: ["0%", "-50%", "0%"],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
            style={{
              filter: "blur(0.5px)",
              boxShadow: "0 0 8px rgba(0, 243, 255, 0.5)"
            }}
          />
        ))}
      </motion.div>
      <motion.span
        className="text-sm text-neon-blue"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        Processing
      </motion.span>
    </div>
  );
}
