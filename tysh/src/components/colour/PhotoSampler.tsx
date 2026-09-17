"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyseSkinPixels, type SkinReading } from "@/lib/colour/skin";
import type { RGB } from "@/lib/colour/convert";
import { CameraIcon } from "@/components/ui/Icons";

const MAX_EDGE = 720;
const TAP_RADIUS = 7;

interface Props {
  onReading: (reading: SkinReading | null) => void;
}

/**
 * Loads a photo into a canvas and samples skin pixels. Everything happens on the
 * device: the image is never uploaded. An automatic sample is taken from the region
 * where a face usually sits in a portrait; the user can then tap cheek, forehead and
 * jaw to refine.
 */
export function PhotoSampler({ onReading }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [taps, setTaps] = useState<{ x: number; y: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<SkinReading | null>(null);

  const sample = useCallback(
    (points: { x: number; y: number }[]) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return;
      const pixels: RGB[] = [];
      const push = (x0: number, y0: number, w: number, h: number, step: number) => {
        const data = ctx.getImageData(Math.max(0, x0), Math.max(0, y0), Math.min(w, canvas.width - x0), Math.min(h, canvas.height - y0)).data;
        for (let i = 0; i < data.length; i += 4 * step) pixels.push([data[i], data[i + 1], data[i + 2]]);
      };
      if (points.length) {
        for (const p of points) push(Math.round(p.x - TAP_RADIUS), Math.round(p.y - TAP_RADIUS), TAP_RADIUS * 2, TAP_RADIUS * 2, 1);
      } else {
        // Face zone heuristic for a portrait: central 40% width, 25–65% height.
        const x0 = canvas.width * 0.3;
        const y0 = canvas.height * 0.25;
        push(Math.round(x0), Math.round(y0), Math.round(canvas.width * 0.4), Math.round(canvas.height * 0.4), 3);
      }
      const r = analyseSkinPixels(pixels);
      setReading(r);
      onReading(r);
      setError(r ? null : "We could not find enough skin in that area. Tap directly on your cheek or forehead.");
    },
    [onReading],
  );

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setTaps([]);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setLoaded(true);
      sample([]);
    };
    img.onerror = () => setError("That file could not be read as an image.");
    img.src = url;
  };

  const onTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const next = [...taps, { x, y }].slice(-3);
    setTaps(next);
    sample(next);
  };

  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Draw tap markers on an overlay layer (redraw markers only; image stays).
    ctx.save();
    ctx.strokeStyle = "#fbfaf7";
    ctx.lineWidth = 2;
    for (const t of taps) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, TAP_RADIUS + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }, [taps, loaded]);

  return (
    <div>
      {!loaded && (
        <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-4 border border-dashed border-sand bg-bone text-center transition hover:border-ink">
          <CameraIcon width={28} height={28} />
          <span className="eyebrow text-ink">Take or choose a photo</span>
          <span className="max-w-xs px-6 text-xs leading-relaxed text-stone">
            Face the window, no makeup if possible, no filters. The photo stays on your device.
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}
      <div className={loaded ? "block" : "hidden"}>
        <canvas ref={canvasRef} onClick={onTap} className="mx-auto max-h-[52vh] w-auto max-w-full cursor-crosshair" aria-label="Your photo. Tap on your skin to sample it." />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone">
            {taps.length ? `${taps.length} sample${taps.length > 1 ? "s" : ""} taken. Tap up to three spots.` : "Auto-sampled the face area. Tap your cheek, forehead and jaw to refine."}
          </p>
          <label className="eyebrow cursor-pointer text-ink link-underline">
            Use a different photo
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
      </div>
      {reading && (
        <div className="mt-5 flex items-center gap-4 border-t border-line pt-5">
          <span className="h-12 w-12 shrink-0 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: reading.hex }} aria-label={`Sampled skin colour ${reading.hex}`} />
          <div className="text-sm">
            <p className="text-ink">
              <span className="capitalize">{reading.undertone}</span> undertone · <span className="capitalize">{reading.depth}</span> depth
            </p>
            <p className="mt-1 text-xs text-stone">
              L* {reading.lab.L.toFixed(0)} · hue {reading.lch.h.toFixed(0)}° · ITA {reading.ita.toFixed(0)}° · {reading.sampleSize} skin pixels
            </p>
          </div>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-oxblood" role="alert">{error}</p>}
    </div>
  );
}
