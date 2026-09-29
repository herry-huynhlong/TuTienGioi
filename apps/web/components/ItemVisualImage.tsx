"use client";

import { useState } from "react";

export function ItemVisualImage({ src, fallbackSrc, className }: { src: string; fallbackSrc: string; className: string }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  return (
    <img
      className={className}
      src={currentSrc}
      alt=""
      aria-hidden
      onError={() => {
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}
