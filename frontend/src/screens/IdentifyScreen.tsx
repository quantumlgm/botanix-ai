import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CloudRain,
  Droplets,
  Gauge,
  ImagePlus,
  Leaf,
  Loader2,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  Sun,
  Thermometer,
} from "lucide-react";
import { identifyPlant } from "../api/endpoints";
import { getPlantIdentificationErrorMessage } from "../api/errors";
import type { PlantIdentificationResult } from "../api/types";
import { CameraCapture } from "../components/CameraCapture";
import type { CameraCaptureHandle } from "../components/CameraCapture";
import {
  SUPPORTED_IMAGE_ACCEPT,
  getImageErrorMessage,
  prepareImageForUpload,
} from "../utils/images";
import {
  buildCareTipsFromData,
  extractCareTips,
  type CareTipKey,
} from "../utils/care";

interface IdentifyScreenProps {
  onOpenChat: (chatId: string, title?: string) => void;
  onBack?: () => void;
}

function CareTipIcon({
  careKey,
  tone = "default",
}: {
  careKey: CareTipKey;
  tone?: "default" | "danger";
}) {
  const props = {
    className: `h-4 w-4 ${tone === "danger" ? "text-danger" : "text-accent"}`,
    strokeWidth: 1.7,
  };

  if (careKey === "light") {
    return <Sun {...props} />;
  }

  if (careKey === "water") {
    return <Droplets {...props} />;
  }

  if (careKey === "temperature") {
    return <Thermometer {...props} />;
  }

  if (careKey === "humidity") {
    return <CloudRain {...props} />;
  }

  if (careKey === "complexity") {
    return <Gauge {...props} />;
  }

  return <ShieldAlert {...props} />;
}

export function IdentifyScreen({ onOpenChat, onBack }: IdentifyScreenProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<PlantIdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<CameraCaptureHandle | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const imagePreparationIdRef = useRef(0);
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
      imagePreparationIdRef.current += 1;
      identifyAbortRef.current?.abort();
      identifyAbortRef.current = null;
    };
  }, []);

  const applySelectedFile = (file: File) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setQuestion("");
    setResult(null);
    setError(null);
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

  const handleReset = () => {
    imagePreparationIdRef.current += 1;
    setIsPreparingImage(false);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setQuestion("");
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
        question,
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
  const careTips = result
    ? result.data
      ? buildCareTipsFromData(result.data)
      : extractCareTips(result.reply)
    : [];

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
                onClick={() => cameraRef.current?.open()}
                disabled={isPreparingImage}
                className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-primary text-[15px] font-semibold text-primary-ink shadow-float transition duration-200 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Camera className="h-[19px] w-[19px]" strokeWidth={1.9} />
                Сделать фото
              </button>

              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                    fileInputRef.current.click();
                  }
                }}
                disabled={isPreparingImage}
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

            {!result && (
              <div className="mt-4 rounded-3xl border border-line bg-surface p-4 shadow-card transition-colors focus-within:border-accent/45">
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="identify-question"
                    className="text-[12px] font-semibold text-ink"
                  >
                    Вопрос ботанику
                  </label>
                  <span className="text-[10px] text-muted">необязательно</span>
                </div>
                <textarea
                  id="identify-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Например: почему желтеют листья?"
                  rows={2}
                  maxLength={700}
                  disabled={isLoading}
                  className="mt-2 max-h-28 min-h-[52px] w-full resize-none bg-transparent text-[14px] leading-relaxed text-ink placeholder:text-muted focus:outline-none disabled:opacity-60"
                />
                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted">
                  <span>Оставьте пустым — покажем полный разбор растения.</span>
                  <span>{question.length}/700</span>
                </div>
              </div>
            )}

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
                          : careTips.length === 3
                            ? "grid-cols-3"
                            : "grid-cols-2"
                    }`}
                  >
                    {careTips.map((tip) => (
                      <div
                        key={tip.key}
                        className={`min-w-0 rounded-2xl px-3 py-3 ${
                          tip.tone === "danger"
                            ? "bg-danger-soft"
                            : "bg-surface-soft"
                        }`}
                      >
                        <CareTipIcon careKey={tip.key} tone={tip.tone} />
                        <p className="mt-2 text-[10px] font-medium text-ink/70">
                          {tip.label}
                        </p>
                        <p
                          className={`mt-1 line-clamp-3 text-[11px] leading-snug font-medium ${
                            tip.tone === "danger" ? "text-danger" : "text-ink"
                          }`}
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

      <CameraCapture ref={cameraRef} onCapture={applySelectedFile} />
    </div>
  );
}
