import { useState, useRef, useCallback, type ReactNode, type MouseEvent, type TouchEvent } from "react";

interface Login3DCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  enableGlare?: boolean;
  glareOpacity?: number;
  scale?: number;
}

export function Login3DCard({
  children,
  className = "",
  maxTilt = 7,
  perspective = 1100,
  enableGlare = true,
  glareOpacity = 0.15,
  scale = 1.01,
}: Login3DCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<string>("rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
  const [glarePosition, setGlarePosition] = useState<{ x: number; y: number; opacity: number }>({
    x: 50,
    y: 50,
    opacity: 0,
  });
  const [isHovered, setIsHovered] = useState(false);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Normalized coordinates (-0.5 to 0.5)
      const xNorm = (clientX - rect.left) / width - 0.5;
      const yNorm = (clientY - rect.top) / height - 0.5;

      // Calculate tilt angles
      const rotateX = -yNorm * maxTilt * 2;
      const rotateY = xNorm * maxTilt * 2;

      setTransform(
        `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`
      );

      // Glare position in percentages (0 - 100)
      const glareX = ((clientX - rect.left) / width) * 100;
      const glareY = ((clientY - rect.top) / height) * 100;
      setGlarePosition({
        x: glareX,
        y: glareY,
        opacity: glareOpacity,
      });
    },
    [maxTilt, scale, glareOpacity]
  );

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    handleMove(e.clientX, e.clientY);
  };

  const onMouseEnter = () => {
    setIsHovered(true);
  };

  const onMouseLeave = () => {
    setIsHovered(false);
    setTransform("rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setGlarePosition((prev) => ({ ...prev, opacity: 0 }));
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!e.touches[0]) return;
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const onTouchEnd = () => {
    setIsHovered(false);
    setTransform("rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setGlarePosition((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      style={{ perspective: `${perspective}px` }}
      className="relative will-change-transform"
    >
      <div
        ref={cardRef}
        onMouseMove={onMouseMove}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform,
          transformStyle: "preserve-3d",
          transition: isHovered ? "transform 0.08s ease-out" : "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        className={`relative ${className}`}
      >
        {children}

        {/* Dynamic Specular Glare Reflection Overlay */}
        {enableGlare && (
          <div
            className="absolute inset-0 rounded-inherit pointer-events-none overflow-hidden transition-opacity duration-300"
            style={{
              borderRadius: "inherit",
              opacity: glarePosition.opacity,
              background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.08) 40%, transparent 75%)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
