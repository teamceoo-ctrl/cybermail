import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export function TerminalText({ text, speed = 20, className = "" }: { text: string, speed?: number, className?: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    setDisplayed("");
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={`font-mono ${className}`}>
      {displayed}
      <span className="animate-pulse opacity-70">_</span>
    </span>
  );
}

export const PageTransition = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className={`w-full h-full ${className}`}
  >
    {children}
  </motion.div>
);
