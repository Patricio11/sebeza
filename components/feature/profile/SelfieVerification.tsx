"use client";

/**
 * 2026-08  live-selfie verification (docs/SELFIE_VERIFICATION_PLAN.md).
 *
 * The entire liveness check runs ON DEVICE: MediaPipe Face Landmarker
 * (self-hosted wasm + model, lazy-loaded only when the dialog opens so
 * the ~4MB model never touches normal page loads  No-Flash rule). The
 * server mints a random two-gesture challenge; the browser confirms a
 * live face performed the gestures; the passing frame becomes the
 * profile photo via the existing WebP pipeline (metadata stripped).
 * No face data is ever sent anywhere for analysis.
 *
 * Copy is English-only for now: biometric-adjacent consent copy sits
 * under the human-translation hold (TRANSLATION_REVIEW_GUIDE.md).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { BadgeCheck, Camera, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandDialog } from "@/components/ui/BrandDialog";
import {
  startSelfieVerification,
  completeSelfieVerification,
  type SelfieGesture,
} from "@/lib/profile/selfie";

const GESTURE_PROMPTS: Record<SelfieGesture, string> = {
  "turn-left": "Slowly turn your head to your LEFT",
  "turn-right": "Slowly turn your head to your RIGHT",
  blink: "Blink both eyes",
  smile: "Give us a smile",
};

type Stage =
  | "consent"
  | "preparing"
  | "calibrating"
  | "gestures"
  | "submitting"
  | "done"
  | "error";

export function SelfieVerification({
  enabled,
  verifiedAt,
  locale,
}: {
  enabled: boolean;
  verifiedAt: string | null;
  locale: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("consent");
  const [error, setError] = useState<string | null>(null);
  const [gestures, setGestures] = useState<SelfieGesture[]>([]);
  const [gestureIdx, setGestureIdx] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<{ close(): void } | null>(null);
  const rafRef = useRef<number>(0);
  const challengeRef = useRef<string>("");

  // Safety net if the component unmounts mid-flow. Declared before the
  // early return below  hooks must run unconditionally.
  useEffect(() => cleanup, []);

  if (!enabled && !verifiedAt) return null;

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      landmarkerRef.current?.close();
    } catch {
      // already closed
    }
    landmarkerRef.current = null;
  }

  function close() {
    if (stage === "submitting") return;
    cleanup();
    setOpen(false);
    setStage("consent");
    setError(null);
    setGestureIdx(0);
  }

  function fail(message: string) {
    cleanup();
    setError(message);
    setStage("error");
  }

  async function begin() {
    setStage("preparing");
    setError(null);
    try {
      const challenge = await startSelfieVerification();
      if (!challenge.ok) {
        fail(challenge.message);
        return;
      }
      challengeRef.current = challenge.challengeId;
      setGestures(challenge.gestures);
      setGestureIdx(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("no video element");
      video.srcObject = stream;
      await video.play();

      // Lazy-load MediaPipe only now  self-hosted assets, no CDN.
      const { FilesetResolver, FaceLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
      landmarkerRef.current = landmarker;

      runLoop(landmarker, challenge.gestures);
    } catch (e) {
      fail(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera access was blocked. Allow camera access in your browser and try again."
          : "Couldn't start the camera check on this device. Please try again.",
      );
    }
  }

  function runLoop(
    landmarker: {
      detectForVideo(v: HTMLVideoElement, ts: number): {
        faceLandmarks: Array<Array<{ x: number; y: number }>>;
        faceBlendshapes?: Array<{
          categories: Array<{ categoryName: string; score: number }>;
        }>;
      };
    },
    challengeGestures: SelfieGesture[],
  ) {
    setStage("calibrating");
    const centerSamples: number[] = [];
    let center = 0.5;
    let idx = 0;
    let holdFrames = 0;

    const tick = () => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return;
      let result;
      try {
        result = landmarker.detectForVideo(video, performance.now());
      } catch {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const face = result.faceLandmarks?.[0];
      const nose = face?.[1];
      const scores = new Map(
        (result.faceBlendshapes?.[0]?.categories ?? []).map((c) => [
          c.categoryName,
          c.score,
        ]),
      );

      if (nose && centerSamples.length < 20) {
        // ~2/3s of "look straight at the camera" before gestures start.
        centerSamples.push(nose.x);
        if (centerSamples.length === 20) {
          center = centerSamples.reduce((a, b) => a + b, 0) / centerSamples.length;
          setStage("gestures");
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (nose && centerSamples.length >= 20) {
        const gesture = challengeGestures[idx];
        // Camera frames are unmirrored: the user's left is the image's right.
        const hit =
          gesture === "turn-left"
            ? nose.x > center + 0.08
            : gesture === "turn-right"
              ? nose.x < center - 0.08
              : gesture === "blink"
                ? (scores.get("eyeBlinkLeft") ?? 0) > 0.45 &&
                  (scores.get("eyeBlinkRight") ?? 0) > 0.45
                : (((scores.get("mouthSmileLeft") ?? 0) +
                    (scores.get("mouthSmileRight") ?? 0)) /
                    2) > 0.4;

        holdFrames = hit ? holdFrames + 1 : 0;
        if (holdFrames >= 3) {
          holdFrames = 0;
          idx += 1;
          setGestureIdx(idx);
          if (idx >= challengeGestures.length) {
            void capture();
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    setStage("submitting");
    try {
      const scale = Math.min(1, 1280 / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      cleanup();
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("capture failed");

      const form = new FormData();
      form.set("challengeId", challengeRef.current);
      form.set("file", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      const result = await completeSelfieVerification(form);
      if (!result.ok) {
        fail(result.message);
        return;
      }
      setStage("done");
      router.refresh();
    } catch {
      fail("Something went wrong while saving your selfie. Please try again.");
    }
  }

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
      {verifiedAt ? (
        <div className="flex items-start gap-2.5">
          <BadgeCheck
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-[color:var(--color-ink)]">
              Profile verified with a live selfie
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
              Completed {fmt.format(new Date(verifiedAt))}. Your profile shows
              the Verified badge.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-ink-soft)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-[color:var(--color-ink)]">
              Verify your profile with a live selfie
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
              A quick camera check proves your profile belongs to a real
              person and earns the Verified badge employers see. The photo
              becomes your profile photo. Nothing else is stored.
            </p>
            <div className="mt-2.5">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setOpen(true)}
              >
                <Camera className="mr-1.5 size-3.5" aria-hidden="true" />
                Verify my profile
              </Button>
            </div>
          </div>
        </div>
      )}

      <BrandDialog
        open={open}
        onClose={close}
        pending={stage === "submitting"}
        eyebrow="Verification"
        title="Live selfie check"
        maxWidth="md"
      >
        <div className="space-y-3 text-sm text-[color:var(--color-ink)]">
          {stage === "consent" && (
            <>
              <p>
                We&rsquo;ll ask for your camera and prompt two quick gestures
                (like a blink or a head turn) to confirm a real person is
                here. The check runs <strong>on your device</strong>: no
                video or face data is sent to us. Only the final photo is
                saved, as your profile photo.
              </p>
              <p className="text-xs text-[color:var(--color-ink-soft)]">
                By continuing you agree to a live photo being taken and used
                as your profile photo with a Verified badge. You can remove
                your photo any time.
              </p>
              <Button type="button" variant="primary" size="sm" onClick={begin}>
                <Camera className="mr-1.5 size-3.5" aria-hidden="true" />
                Start camera check
              </Button>
            </>
          )}

          {(stage === "preparing" ||
            stage === "calibrating" ||
            stage === "gestures" ||
            stage === "submitting") && (
            <>
              <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-black">
                {/* Mirrored preview  standard selfie UX; detection uses raw frames. */}
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="aspect-[4/3] w-full -scale-x-100 object-cover"
                />
              </div>
              <p role="status" className="min-h-5 text-center font-medium">
                {stage === "preparing" && (
                  <span className="inline-flex items-center gap-2 text-[color:var(--color-ink-soft)]">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Starting camera and loading the checker…
                  </span>
                )}
                {stage === "calibrating" && "Look straight at the camera…"}
                {stage === "gestures" &&
                  `${gestureIdx + 1} of ${gestures.length}: ${GESTURE_PROMPTS[gestures[gestureIdx]!]}`}
                {stage === "submitting" && (
                  <span className="inline-flex items-center gap-2 text-[color:var(--color-ink-soft)]">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Saving your verified photo…
                  </span>
                )}
              </p>
            </>
          )}

          {stage === "done" && (
            <div className="flex items-start gap-2.5">
              <BadgeCheck
                className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
                aria-hidden="true"
              />
              <p>
                Done. Your profile now carries the <strong>Verified</strong>{" "}
                badge, and the photo you just took is your profile photo.
              </p>
            </div>
          )}

          {stage === "error" && (
            <>
              <p role="alert" className="text-[color:var(--color-danger)]">
                {error}
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={begin}>
                <RefreshCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                Try again
              </Button>
            </>
          )}
        </div>
      </BrandDialog>
    </div>
  );
}
