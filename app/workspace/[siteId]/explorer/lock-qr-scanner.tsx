"use client";

import { useEffect, useRef, useState } from "react";
import { readLockQr } from "@/lib/manhole-locks";

export function LockQrScanner({
  onResult,
}: {
  onResult: (serial: string) => void;
}) {
  const preview = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Opening camera…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = preview.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "The camera needs a trusted HTTPS connection. You can type the lock ID.",
      );
      setFailed(true);
      return;
    }

    const context = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    if (!context) {
      setMessage("Camera scanning is unavailable. You can type the lock ID.");
      setFailed(true);
      return;
    }
    let closed = false;
    let stream: MediaStream | undefined;
    let frame = 0;
    let lastFrame = 0;
    function stop() {
      cancelAnimationFrame(frame);
      for (const track of stream?.getTracks() ?? []) track.stop();
    }
    function cameraFailed() {
      stop();
      if (!closed) {
        setFailed(true);
        setMessage(
          "The camera is unavailable. Check camera permission or type the lock ID.",
        );
      }
    }

    async function scan() {
      try {
        const { default: decodeQr } = await import("jsqr");
        if (closed || !video || !context) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (closed) {
          stop();
          return;
        }
        for (const track of stream.getVideoTracks())
          track.addEventListener("ended", cameraFailed, { once: true });
        video.srcObject = stream;
        await video.play();
        if (closed) return;
        setMessage("Point the camera at a Hatchlane lock QR code.");

        function readFrame(time: number) {
          if (!video || !context || closed) return;
          if (
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            time - lastFrame >= 125
          ) {
            lastFrame = time;
            const width = Math.min(video.videoWidth, 720);
            const height = Math.round(
              (width * video.videoHeight) / video.videoWidth,
            );
            if (width > 0 && height > 0) {
              let qr: ReturnType<typeof decodeQr>;
              try {
                if (
                  context.canvas.width !== width ||
                  context.canvas.height !== height
                ) {
                  context.canvas.width = width;
                  context.canvas.height = height;
                }
                context.drawImage(video, 0, 0, width, height);
                const pixels = context.getImageData(0, 0, width, height);
                qr = decodeQr(pixels.data, width, height);
              } catch {
                cameraFailed();
                return;
              }
              if (qr) {
                const serial = readLockQr(qr.data);
                if (serial) {
                  stop();
                  onResult(serial);
                  return;
                }
                setMessage(
                  "This is not a supported lock QR code. Try a Hatchlane label or type the lock ID.",
                );
              }
            }
          }
          frame = requestAnimationFrame(readFrame);
        }
        frame = requestAnimationFrame(readFrame);
      } catch {
        cameraFailed();
      }
    }
    void scan();
    return () => {
      closed = true;
      for (const track of stream?.getVideoTracks() ?? [])
        track.removeEventListener("ended", cameraFailed);
      stop();
      video.srcObject = null;
    };
  }, [onResult]);

  return (
    <div className="grid gap-3">
      <p className="text-sm" role="status">
        {message}
      </p>
      <video
        ref={preview}
        muted
        playsInline
        hidden={failed}
        className="aspect-square w-full rounded-lg bg-muted object-cover"
        aria-label="Lock QR camera preview"
      />
    </div>
  );
}
