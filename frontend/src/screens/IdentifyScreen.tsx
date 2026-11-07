import { useState, useRef, useEffect, ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Camera, Loader2, Sparkles, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { identifyPlant } from "../api/endpoints";
import type { PlantIdentificationResult } from "../api/types";

interface IdentifyScreenProps {
  onOpenChat: (chatId: string) => void;
}

export function IdentifyScreen({ onOpenChat }: IdentifyScreenProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<PlantIdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
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
    if (!selectedFile) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await identifyPlant(selectedFile);
      setResult(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Ошибка при распознавании растения. Попробуйте другое фото."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 max-w-md mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {!previewUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-slate-700 bg-slate-800/30 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all gap-4 text-center group active:scale-[0.99] select-none [-webkit-tap-highlight-color:transparent]"
        >
          <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <Camera className="w-10 h-10" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold text-white">
              Сделать фото или выбрать из галереи
            </span>
            <span className="text-xs text-slate-400">
              Постарайтесь, чтобы лист или цветок был в фокусе
            </span>
          </div>
        </button>
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
          onClick={handleUploadAndIdentify}
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
              <div className="max-h-60 overflow-y-auto pr-1 text-xs leading-relaxed text-slate-300 space-y-2 [&>h2]:text-sm [&>h2]:font-bold [&>h2]:text-emerald-400 [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>p]:mb-2">
                <ReactMarkdown>{result.reply}</ReactMarkdown>
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
    </div>
  );
}