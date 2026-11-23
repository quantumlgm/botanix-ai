import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Ref } from "react";
import { Camera, Flashlight, FlashlightOff, Loader2, X } from "lucide-react";
import { captureImageFromVideo, getImageErrorMessage } from "../utils/images";

const CAMERA_ACCESS_TIMEOUT_MS = 10_000;

type TelegramCameraAccess = {
  checkCameraAccess?: () => boolean | Promise<boolean>;
  requestCameraAccess?: (
    callback?: (granted: boolean) => void
  ) => void | boolean | Promise<boolean>;
};

export interface CameraCaptureHandle {
  open: () => void;
}

interface CameraCaptureProps {
  ref?: Ref<CameraCaptureHandle>;
  onCapture: (file: File) => void;
}

class CameraAccessTimeoutError extends Error {
  constructor() {
    super("Camera access request timed out");
    this.name = "CameraAccessTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new CameraAccessTimeoutError());
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function getCameraAccessErrorMessage(error: unknown): string {
  if (error instanceof CameraAccessTimeoutError) {
    return "Telegram не ответил на запрос доступа к камере. Попробуйте ещё раз.";
  }

  if (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  ) {
    return "Разрешите доступ к камере в Telegram и попробуйте снова.";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "Камера не найдена на этом устройстве.";
  }

  return "Не удалось открыть камеру. Выберите фото из галереи или разрешите доступ к камере.";
}

async function requestCameraAccess(): Promise<boolean> {
  const webApp = window.Telegram?.WebApp as
    | (NonNullable<typeof window.Telegram>["WebApp"] & TelegramCameraAccess)
    | undefined;

  if (!webApp) {
    return true;
  }

  if (webApp.checkCameraAccess && (await webApp.checkCameraAccess())) {
    return true;
  }

  if (!webApp.requestCameraAccess) {
    return true;
  }

  return new Promise<boolean>((resolve, reject) => {
    const finish = (granted: boolean) => resolve(granted);

    try {
      const result = webApp.requestCameraAccess?.(finish);
      if (result instanceof Promise) {
        result.then(finish, reject);
      } else if (typeof result === "boolean") {
        finish(result);
      }
    } catch (requestError) {
      reject(requestError);
    }
  });
}

export function CameraCapture({ ref, onCapture }: CameraCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);
  const captureInProgressRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cameraRequestIdRef.current += 1;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  const stopCameraStream = useCallback(() => {
    cameraRequestIdRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setIsTorchSupported(false);
    setTorchOn(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopCameraStream();
    setIsOpen(false);
  }, [stopCameraStream]);

  const handleCameraTrackEnded = useCallback(() => {
    stopCameraStream();
    setCameraError("Камера перестала быть доступна. Попробуйте открыть её снова.");
  }, [stopCameraStream]);

  const openCamera = useCallback(async () => {
    setIsOpeningCamera(true);
    stopCameraStream();
    const requestId = cameraRequestIdRef.current;
    setCameraError(null);

    try {
      const granted = await withTimeout(
        requestCameraAccess(),
        CAMERA_ACCESS_TIMEOUT_MS
      );

      if (!granted) {
        if (requestId === cameraRequestIdRef.current) {
          setCameraError(
            "Разрешите доступ к камере в Telegram и попробуйте снова."
          );
        }
        return;
      }

      if (requestId !== cameraRequestIdRef.current || !isMountedRef.current) {
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is unavailable");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      if (requestId !== cameraRequestIdRef.current || !isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      if (document.visibilityState === "hidden") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean })
        | undefined;

      track?.addEventListener("ended", handleCameraTrackEnded);
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setIsTorchSupported(Boolean(capabilities?.torch));
    } catch (err: unknown) {
      if (requestId === cameraRequestIdRef.current && isMountedRef.current) {
        setCameraError(getCameraAccessErrorMessage(err));
      }
    } finally {
      if (requestId === cameraRequestIdRef.current && isMountedRef.current) {
        setIsOpeningCamera(false);
      }
    }
  }, [handleCameraTrackEnded, stopCameraStream]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    void openCamera();
  }, [openCamera]);

  useImperativeHandle(ref, () => ({ open: handleOpen }), [handleOpen]);

  useEffect(() => {
    if (isOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, isOpen]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (!cameraStreamRef.current) return;

      closeCamera();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [closeCamera]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeCamera();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCamera, isOpen]);

  const toggleTorch = async () => {
    const track = cameraStreamRef.current?.getVideoTracks()[0];
    if (!track || !isTorchSupported) {
      return;
    }

    const nextTorchState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorchState } as MediaTrackConstraintSet],
      });
      if (cameraStreamRef.current?.getVideoTracks()[0] === track) {
        setTorchOn(nextTorchState);
      }
      setCameraError(null);
    } catch {
      setCameraError("Не удалось переключить фонарик на этой камере.");
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || captureInProgressRef.current) {
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setCameraError("Камера ещё не готова. Попробуйте ещё раз.");
      return;
    }

    captureInProgressRef.current = true;
    setIsCapturing(true);
    setCameraError(null);

    try {
      const file = await captureImageFromVideo(video);
      if (!isMountedRef.current) {
        return;
      }

      closeCamera();
      onCapture(file);
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setCameraError(getImageErrorMessage(err));
      }
    } finally {
      captureInProgressRef.current = false;
      if (isMountedRef.current) {
        setIsCapturing(false);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Камера"
      className="fixed inset-0 z-50 overflow-hidden overscroll-contain bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55"
      />

      <div
        className="relative z-10 flex h-full flex-col"
        style={{
          paddingTop:
            "max(0.75rem, env(safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px))",
          paddingBottom:
            "max(1.75rem, env(safe-area-inset-bottom, 0px), var(--tg-safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center justify-between px-4 py-1">
          <button
            type="button"
            onClick={closeCamera}
            aria-label="Закрыть камеру"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition active:scale-95"
          >
            <X className="h-5 w-5" strokeWidth={1.7} />
          </button>

          {isTorchSupported && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-label={torchOn ? "Выключить фонарик" : "Включить фонарик"}
              aria-pressed={torchOn}
              className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${
                torchOn
                  ? "border-white bg-white text-black"
                  : "border-white/20 bg-white/10 text-white"
              }`}
            >
              {torchOn ? (
                <FlashlightOff className="h-5 w-5" strokeWidth={1.7} />
              ) : (
                <Flashlight className="h-5 w-5" strokeWidth={1.7} />
              )}
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          {!cameraStream && isOpeningCamera && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-2.5 text-white/80"
            >
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.7} />
              <span className="text-[13px]">Открываем камеру…</span>
            </div>
          )}
        </div>

        {cameraError && (
          <p
            role="status"
            className="relative z-10 mx-5 mb-4 rounded-2xl border border-white/10 bg-black/55 p-3 text-center text-[12px] leading-relaxed text-white backdrop-blur-md"
          >
            {cameraError}
          </p>
        )}

        {cameraStream && (
          <div className="relative z-10 flex flex-col items-center px-6">
            <div className="flex h-[78px] w-[78px] items-center justify-center rounded-full border border-white/40">
              <button
                type="button"
                onClick={() => void capturePhoto()}
                disabled={isCapturing}
                aria-label="Сделать снимок"
                aria-busy={isCapturing}
                className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-white text-black shadow-[0_0_36px_rgba(255,255,255,0.25)] transition active:scale-95 disabled:opacity-70"
              >
                {isCapturing ? (
                  <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.7} />
                ) : (
                  <Camera className="h-6 w-6" strokeWidth={1.7} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
