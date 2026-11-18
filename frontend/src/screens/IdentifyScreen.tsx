import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Droplets,
  Flashlight,
  FlashlightOff,
  ImagePlus,
  Leaf,
  Loader2,
  RefreshCw,
  ScanSearch,
  Sun,
  Thermometer,
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
import { extractCareTips, type CareTipKey } from "../utils/care";

const CAMERA_ACCESS_TIMEOUT_MS = 10_000;

type TelegramCameraAccess = {
  checkCameraAccess?: () => boolean | Promise<boolean>;
  requestCameraAccess?: (
    callback?: (granted: boolean) => void
  ) => void | boolean | Promise<boolean>;
};

interface IdentifyScreenProps {
  onOpenChat: (chatId: string, title?: string) => void;
  onBack?: () => void;
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

function CareTipIcon({ careKey }: { careKey: CareTipKey }) {
  const props = {
    className: "h-4 w-4 text-accent",
    strokeWidth: 1.7,
  };

  if (careKey === "light") {
    return <Sun {...props} />;
  }

  if (careKey === "water") {
    return <Droplets {...props} />;
  }

  return <Thermometer {...props} />;
}

export function IdentifyScreen({ onOpenChat, onBack }: IdentifyScreenProps) {
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

  const confidencePercent = result
    ? Math.max(0, Math.min(100, Math.round(result.confidence * 100)))
    : 0;
  const careTips = result ? extractCareTips(result.reply) : [];

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(event) => void handleFileChange(event)}
        accept={SUPPORTED_IMAGE_ACCEPT}
        className="sr-only"
      />

      <header className="safe-top shrink-0 px-6">
        <div className="grid h-14 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Назад"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition active:scale-95"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <h1 className="truncate text-center font-serif text-[20px] leading-none font-semibold tracking-[-0.005em] text-ink">
            Определение растения
          </h1>
          <span aria-hidden="true" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6">
        <div className="mt-3 flex flex-col">
          {!previewUrl ? (
          <div className="animate-fade">
            <div className="flex flex-col items-center rounded-[30px] border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Camera className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <h2 className="mt-5 font-serif text-[27px] leading-[1.05] font-semibold tracking-[-0.01em] text-ink">
                Сфотографируйте растение
              </h2>
              <p className="mt-2 max-w-[255px] text-[12.5px] leading-relaxed text-muted">
                Лист или цветок крупным планом — так ботаник точнее определит
                вид.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => void openCamera()}
                disabled={isOpeningCamera || isPreparingImage}
                className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-primary text-[15px] font-semibold text-primary-ink shadow-float transition duration-200 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOpeningCamera ? (
                  <Loader2 className="h-[19px] w-[19px] animate-spin" strokeWidth={1.9} />
                ) : (
                  <Camera className="h-[19px] w-[19px]" strokeWidth={1.9} />
                )}
                {isOpeningCamera ? "Открываем камеру…" : "Сделать фото"}
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
                className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-full border border-line bg-surface/70 text-[13px] font-medium text-ink transition duration-200 active:scale-[0.99] active:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPreparingImage ? (
                  <>
                    <Loader2 className="h-[17px] w-[17px] animate-spin text-accent" strokeWidth={1.7} />
                    Обработка фото…
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-[17px] w-[17px] text-accent-ink" strokeWidth={1.7} />
                    Выбрать из галереи
                  </>
                )}
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] text-muted">
              JPG, PNG или WebP · до 5 МБ
            </p>

            {cameraError && (
              <p
                role="status"
                className="mt-3 flex items-start justify-center gap-2 text-center text-[11.5px] leading-relaxed text-sand"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
                {cameraError}
              </p>
            )}
          </div>
        ) : (
          <div className="animate-fade">
            <div className="relative overflow-hidden rounded-3xl bg-surface-soft shadow-card">
              <img
                src={previewUrl}
                alt="Выбранное растение"
                className="h-[320px] w-full object-cover"
              />

              {!isLoading && (
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Переснять"
                  className="absolute top-3 right-3 flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-3 text-[11.5px] font-medium text-white backdrop-blur-md transition active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Переснять
                </button>
              )}

              {isLoading && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 overflow-hidden bg-black/55 backdrop-blur-[2px]"
                >
                  <span aria-hidden="true" className="scan-sweep" />
                  <div className="relative flex h-full flex-col items-center justify-center gap-2.5 text-center text-white">
                    <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.7} />
                    <span className="text-[13px] font-medium">
                      Определяем вид растения…
                    </span>
                    <span className="text-[11px] text-white/65">
                      Обычно это занимает несколько секунд
                    </span>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-2xl bg-danger-soft p-3.5 text-[12px] leading-relaxed text-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
                <span>{error}</span>
              </div>
            )}

            {!result && !isLoading && (
              <>
                <button
                  type="button"
                  onClick={() => void handleUploadAndIdentify()}
                  className="mt-4 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-primary text-[15px] font-semibold text-primary-ink shadow-float transition duration-200 active:scale-[0.985]"
                >
                  <ScanSearch className="h-[19px] w-[19px]" strokeWidth={1.9} />
                  Распознать растение
                </button>
                <p className="mt-3 flex items-start justify-center gap-2 px-5 text-center text-[11px] leading-relaxed text-muted">
                  <Leaf className="mt-px h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.6} />
                  Мягкий рассеянный свет и лист крупным планом помогут
                  определить вид точнее.
                </p>
              </>
            )}

            {result && (
              <div
                role="region"
                aria-label="Результат анализа"
                className="animate-rise mt-4 rounded-[30px] border border-line bg-surface p-6 shadow-card"
              >
                <p className="text-[11px] font-medium text-muted">
                  PlantNet · семейство {result.family_name}
                </p>

                <h2 className="mt-2 font-serif text-[30px] leading-[0.98] font-semibold italic break-words text-ink">
                  {result.scientific_name}
                </h2>

                {result.common_names && result.common_names.length > 0 && (
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                    {result.common_names.join(" · ")}
                  </p>
                )}

                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[11.5px] font-semibold text-accent-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {confidencePercent}% точность
                </span>

                {careTips.length > 0 && (
                  <div
                    className={`mt-5 grid gap-2 ${
                      careTips.length === 1
                        ? "grid-cols-1"
                        : careTips.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-3"
                    }`}
                  >
                    {careTips.map((tip) => (
                      <div
                        key={tip.key}
                        className="min-w-0 rounded-2xl bg-surface-soft px-3 py-3"
                      >
                        <CareTipIcon careKey={tip.key} />
                        <p className="mt-2 text-[10px] font-medium text-ink/70">
                          {tip.label}
                        </p>
                        <p
                          className="mt-1 line-clamp-3 text-[11px] leading-snug font-medium text-ink"
                          title={tip.value}
                        >
                          {tip.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {result.reply && (
                  <>
                    <div className="my-5 h-px bg-line" />
                    <div className="botanix-markdown break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {result.reply}
                      </ReactMarkdown>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        )}
        </div>
        <div className="safe-bottom" aria-hidden="true" />
      </div>

      {result && (
        <div className="safe-bottom relative shrink-0 bg-canvas px-6 pt-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-canvas to-transparent"
          />
          <button
            type="button"
            onClick={() =>
              onOpenChat(result.chat_id || "new", result.scientific_name)
            }
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-ink shadow-float transition duration-200 active:scale-[0.985]"
          >
            Спросить ботаника
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      )}

      {isCameraOpen && (
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

            <div className="min-h-0 flex-1" />

            {cameraError && (
              <p
                role="status"
                className="relative z-10 mx-5 mb-4 rounded-2xl border border-white/10 bg-black/55 p-3 text-center text-[12px] leading-relaxed text-white backdrop-blur-md"
              >
                {cameraError}
              </p>
            )}

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
          </div>
        </div>
      )}
    </div>
  );
}
