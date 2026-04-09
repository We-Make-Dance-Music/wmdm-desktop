// ============================================================
// WMDM Desktop App — Waveform Visualizer
// Canvas-based waveform with clickable scrubbing
// ============================================================

import { useRef, useEffect, useCallback } from "react";

interface WaveformProps {
  /** Array of amplitude values (0-1) */
  data: number[];
  /** Current playback progress (0-100) */
  progress: number;
  /** Called when user clicks to scrub */
  onSeek: (percent: number) => void;
  /** Height in pixels */
  height?: number;
  /** Color for played portion */
  playedColor?: string;
  /** Color for unplayed portion */
  unplayedColor?: string;
}

export default function Waveform({
  data,
  progress,
  onSeek,
  height = 32,
  playedColor = "#6366f1",
  unplayedColor = "#1e1e2e",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) {
      // No data — draw a simple animated-looking bar pattern
      const barCount = Math.floor(width / 3);
      const barWidth = 1.5;
      const gap = (width - barCount * barWidth) / barCount;
      const progressX = (progress / 100) * width;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + gap);
        // Generate a pseudo-random but consistent height
        const seed = Math.sin(i * 0.3) * 0.5 + Math.sin(i * 0.7) * 0.3 + 0.5;
        const barHeight = Math.max(2, seed * height * 0.8);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = x < progressX ? playedColor : unplayedColor;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      return;
    }

    // Resample waveform data to fit the canvas width
    const barCount = Math.floor(width / 3);
    const barWidth = 1.5;
    const gap = (width - barCount * barWidth) / barCount;
    const samplesPerBar = data.length / barCount;
    const progressX = (progress / 100) * width;

    for (let i = 0; i < barCount; i++) {
      // Average the samples for this bar
      const startSample = Math.floor(i * samplesPerBar);
      const endSample = Math.min(Math.floor((i + 1) * samplesPerBar), data.length);
      let sum = 0;
      let count = 0;
      for (let j = startSample; j < endSample; j++) {
        sum += Math.abs(data[j]);
        count++;
      }
      const amplitude = count > 0 ? sum / count : 0;

      const x = i * (barWidth + gap);
      const barHeight = Math.max(2, amplitude * height * 0.9);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = x < progressX ? playedColor : unplayedColor;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [data, progress, height, playedColor, unplayedColor]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on resize
  useEffect(() => {
    const observer = new ResizeObserver(() => draw());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div
      ref={containerRef}
      className="w-full cursor-pointer"
      onClick={handleClick}
      style={{ height }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
