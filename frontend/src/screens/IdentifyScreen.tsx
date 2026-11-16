import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Flashlight,
  FlashlightOff,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { identifyPlant } from "../api/endpoints";
import { getPlantIdentificationErrorMessage } from "../api/errors";
import type { PlantIdentificationResult } from "../api/types";
import {
  ImageError,
  SUPPORTED_IMAGE_ACCEPT,
  captureImageFromVideo,
  prepareImageForUpload,
} from "../utils/images";

const CAMERA_ACCESS_TIMEOUT_MS = 10_000;

type TelegramCameraAccess = {
  checkCameraAccess?: () => boolean | Promise<boolean>;
  requestCameraAccess?: (
    callback?: (granted: boolean) => void
  ) => void | boolean | Promise<boolean>;
};

interface IdentifyScreenProps {
  onOpenChat: (chatId: string) => void;
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

function getImageErrorMessage(error: unknown): string {
  if (error instanceof ImageError) {
    if (error.code === "heic_not_supported") {
      return "Формат HEIC не поддерживается. Выберите фото в формате JPG, PNG или WebP.";
    }
    if (error.code === "too_large") {
      return "Файл слишком большой. Максимальный размер — 5 МБ.";
    }
    if (error.code === "unsupported_type") {
      return "Этот формат файла не поддерживается. Выберите JPG, PNG или WebP.";
    }
  }

  return "Не удалось обработать изображение. Попробуйте другое фото.";
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

export function IdentifyScreen({ onOpenChat }: IdentifyScreenProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<PlantIdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const cameraRequestIdRef = useRef(0);
  const cameraRequestInProgressRef = useRef(false);
  const imagePreparationIdRef = useRef(0);
  const captureInProgressRef = useRef(false);
  const identifyAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cameraRequestIdRef.current += 1;
      imagePreparationIdRef.current += 1;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      identifyAbortRef.current?.abort();
      identifyAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, isCameraOpen]);

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

  const handleCameraTrackEnded = useCallback(() => {
    stopCameraStream();
    setIsCameraOpen(false);
    setCameraError("Камера перестала быть доступна. Попробуйте открыть её снова.");
  }, [stopCameraStream]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (!cameraStreamRef.current) return;

      stopCameraStream();
      setIsCameraOpen(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stopCameraStream]);

  const applySelectedFile = (file: File) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setResult(null);
    setError(null);
    setCameraError(null);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    input.value = "";

    if (!file) return;

    const requestId = imagePreparationIdRef.current + 1;
    imagePreparationIdRef.current = requestId;
    setIsPreparingImage(true);
    setError(null);
    setCameraError(null);

    try {
      const preparedFile = await prepareImageForUpload(file);
      if (
        requestId !== imagePreparationIdRef.current ||
        !isMountedRef.current
      ) {
        return;
      }
      applySelectedFile(preparedFile);
    } catch (err: unknown) {
      if (
        requestId === imagePreparationIdRef.current &&
        isMountedRef.current
      ) {
        setError(getImageErrorMessage(err));
      }
    } finally {
      if (
        requestId === imagePreparationIdRef.current &&
        isMountedRef.current
      ) {
        setIsPreparingImage(false);
      }
    }
  };

  const requestCameraAccess = async (): Promise<boolean> => {
    const webApp = window.Telegram?.WebApp as
      | (NonNullable<typeof window.Telegram>["WebApp"] &
          TelegramCameraAccess)
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
  };

  const openCamera = async () => {
    if (cameraRequestInProgressRef.current) {
      return;
    }

    cameraRequestInProgressRef.current = true;
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
      setIsCameraOpen(true);
    } catch (err: unknown) {
      if (requestId === cameraRequestIdRef.current && isMountedRef.current) {
        setCameraError(getCameraAccessErrorMessage(err));
      }
    } finally {
      cameraRequestInProgressRef.current = false;
      if (isMountedRef.current) {
        setIsOpeningCamera(false);
      }
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setIsCameraOpen(false);
  };

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
      applySelectedFile(file);
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

  const handleReset = () => {
    imagePreparationIdRef.current += 1;
    setIsPreparingImage(false);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadAndIdentify = async () => {
    if (!selectedFile || identifyAbortRef.current) {
      return;
    }

    const controller = new AbortController();
    identifyAbortRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const data = await identifyPlant(selectedFile, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || !isMountedRef.current) {
        return;
      }
      setResult(data);
    } catch (err: unknown) {
      if (controller.signal.aborted || !isMountedRef.current) {
        return;
      }
      setError(
        getPlantIdentificationErrorMessage(
          err,
          "Не удалось распознать изображение. Попробуйте другое фото растения."
        )
      );
    } finally {
      if (identifyAbortRef.current === controller) {
        identifyAbortRef.current = null;
      }
      if (!controller.signal.aborted && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 max-w-md mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(event) => void handleFileChange(event)}
        accept={SUPPORTED_IMAGE_ACCEPT}
        className="sr-only"
      />

      {!previewUrl ? (
        <>
          <button
            type="button"
            onClick={() => void openCamera()}
            disabled={isOpeningCamera || isPreparingImage}
            className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-slate-700 bg-slate-800/30 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all gap-4 text-center group active:scale-[0.99] select-none [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              {isOpeningCamera ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : (
                <Camera className="w-10 h-10" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-white">
                {isOpeningCamera ? "Запрашиваем доступ..." : "Сделать снимок"}
              </span>
              <span className="text-xs text-slate-400">
                Постарайтесь, чтобы лист или цветок был в фокусе
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
                fileInputRef.current.click();
              }
            }}
            disabled={isPreparingImage || isOpeningCamera}
            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 py-3 text-sm font-medium text-slate-200 transition hover:border-emerald-500/50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPreparingImage ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                Обработка фото...
              </span>
            ) : (
              "Выбрать из галереи"
            )}
          </button>
          {cameraError && (
            <p role="status" className="text-center text-xs text-amber-300">
              {cameraError}
            </p>
          )}
        </>
      ) : (
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl">
          <img
            src={previewUrl}
            alt="Выбранное растение"
            className="w-full h-64 object-cover"
          />

          {!isLoading && (
            <button
              type="button"
              onClick={handleReset}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-slate-300 hover:text-white backdrop-blur border border-slate-700 active:scale-95 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300 animate-pulse">
                Нейросеть определяет вид...
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {previewUrl && !result && !isLoading && (
        <button
          type="button"
          onClick={() => void handleUploadAndIdentify()}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 select-none [-webkit-tap-highlight-color:transparent]"
        >
          <Sparkles className="w-5 h-5" />
          <span>Распознать растение</span>
        </button>
      )}

      {result && (
        <div className="flex flex-col gap-4 p-5 rounded-3xl bg-slate-800/60 border border-emerald-500/30 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                Результат анализа
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {result.scientific_name}
              </h3>
              {result.common_names && result.common_names.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {result.common_names.join(", ")}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-400">Точность</span>
              <span className="text-sm font-bold text-emerald-400">
                {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {result.reply && (
            <div className="border-t border-slate-700/60 pt-3">
              <div className="max-h-60 overflow-y-auto overflow-x-auto pr-1 text-xs leading-relaxed text-slate-300 space-y-2 [&>h2]:text-sm [&>h2]:font-bold [&>h2]:text-emerald-400 [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>p]:mb-2 [&_strong]:font-bold [&_em]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-600 [&_th]:bg-slate-700/60 [&_th]:px-2 [&_th]:py-1.5 [&_td]:border [&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1.5 [&_a]:text-emerald-400 [&_a]:underline">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.reply}
                </ReactMarkdown>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onOpenChat(result.chat_id || "new")}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-sm font-semibold active:scale-[0.98] transition-all mt-1 select-none [-webkit-tap-highlight-color:transparent]"
          >
            <span>Задать вопрос по уходу</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {isCameraOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Камера"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden overscroll-contain bg-black"
          style={{
            height: "var(--tg-viewport-height, 100dvh)",
            paddingTop:
              "max(1rem, env(safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px))",
            paddingBottom:
              "max(1rem, env(safe-area-inset-bottom, 0px), var(--tg-safe-area-inset-bottom, 0px))",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="relative z-10 flex items-center justify-between p-4">
            <button
              type="button"
              onClick={closeCamera}
              aria-label="Закрыть камеру"
              className="rounded-full bg-black/50 p-3 text-white backdrop-blur"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              {isTorchSupported && (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  aria-label={torchOn ? "Выключить фонарик" : "Включить фонарик"}
                  aria-pressed={torchOn}
                  className={`rounded-full p-3 text-white backdrop-blur ${
                    torchOn ? "bg-emerald-500/80" : "bg-black/50"
                  }`}
                >
                  {torchOn ? (
                    <FlashlightOff className="h-5 w-5" />
                  ) : (
                    <Flashlight className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
          </div>
          {cameraError && (
            <p
              role="status"
              className="relative z-10 mx-4 rounded-xl bg-black/60 p-3 text-center text-sm text-white"
            >
              {cameraError}
            </p>
          )}
          <div className="relative z-10 mt-auto flex justify-center p-16">
            <button
              type="button"
              onClick={() => void capturePhoto()}
              disabled={isCapturing}
              aria-label="Сделать снимок"
              aria-busy={isCapturing}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white shadow-lg active:scale-95 disabled:opacity-70"
            >
              {isCapturing ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Camera className="h-7 w-7" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
