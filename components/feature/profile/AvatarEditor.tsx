"use client";

/**
 * Profile photo editor — client island for the dashboard.
 *
 * Flow:
 *   1. User picks a file (camera roll on mobile, file picker on desktop)
 *   2. Client-side resize to 512×512 (canvas) — keeps upload small, respects
 *      the No-Flash / low-bandwidth rule
 *   3. Send as multipart FormData to `uploadProfilePhoto`
 *   4. On success, update the on-screen preview from the new signed URL
 *
 * Remove flow → `removeProfilePhoto`.
 */

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { uploadProfilePhoto, removeProfilePhoto } from "@/lib/profile/photo";

const MAX_SIDE_PX = 512;
const JPEG_QUALITY = 0.85;

interface Props {
  name: string;
  initialUrl: string | null;
}

export function AvatarEditor({ name, initialUrl }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick() {
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const compressed = await compressToJpeg(file, MAX_SIDE_PX, JPEG_QUALITY);
      const preview = URL.createObjectURL(compressed);
      setPreviewUrl(preview);
      startTransition(async () => {
        const fd = new FormData();
        fd.append("file", compressed, "avatar.jpg");
        const r = await uploadProfilePhoto(fd);
        if (!r.ok) {
          setError(r.message);
          setPreviewUrl(initialUrl);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that image.");
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const r = await removeProfilePhoto();
      if (r.ok) setPreviewUrl(null);
      else setError(r.message);
    });
  }

  const initials = getInitials(name);

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <button
          type="button"
          onClick={onPick}
          disabled={pending}
          aria-label="Change profile photo"
          className="group relative size-24 overflow-hidden rounded-full border-2 border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)]"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${name} profile photo`}
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center font-display text-2xl text-[color:var(--color-ink-soft)]">
              {initials}
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[color:var(--color-ink)]/0 text-[color:var(--color-paper)] opacity-0 transition-opacity group-hover:bg-[color:var(--color-ink)]/45 group-hover:opacity-100">
            <Camera className="size-6" aria-hidden="true" />
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onChange}
        />
      </div>
      <div className="space-y-2">
        <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          Profile photo
        </div>
        <p className="max-w-md text-sm text-[color:var(--color-ink-soft)]">
          JPEG, PNG or WebP. Resized to 512 px on your device before upload, so
          it stays light on data.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPick}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-4 py-2 text-sm font-medium text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-tint)] disabled:opacity-60"
          >
            <Upload className="size-4" aria-hidden="true" />
            {pending ? "Uploading…" : previewUrl ? "Change photo" : "Upload photo"}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-60"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
        {error && <p className="text-xs text-[color:var(--color-danger)]">{error}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Reads `file` into an Image, resizes to fit `maxSide` while keeping aspect,
 * and re-encodes as a JPEG blob. Returns a File suitable for FormData.
 */
async function compressToJpeg(
  file: File,
  maxSide: number,
  quality: number,
): Promise<File> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't encode image."))),
      "image/jpeg",
      quality,
    );
  });
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Read failed."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't decode image."));
    img.src = src;
  });
}
