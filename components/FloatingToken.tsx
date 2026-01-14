"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface FloatingTokenProps {
  src: string;
  alt: string;
  size: number;
  className?: string;
}

export default function FloatingToken({ src, alt, size, className = "" }: FloatingTokenProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDuration(5 + Math.random() * 3);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={`absolute animate-float-slow hover:scale-110 transition-transform duration-500 ${className}`}
      style={{
        animation: duration ? `float ${duration}s ease-in-out infinite` : undefined,
      }}
    >
      <div className="relative group">
        <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="relative z-10 drop-shadow-2xl"
        />
      </div>
    </div>
  );
}