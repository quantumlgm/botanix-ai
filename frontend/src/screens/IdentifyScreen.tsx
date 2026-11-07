import { UploadCloud } from "lucide-react";

export function IdentifyScreen() {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <UploadCloud className="h-10 w-10" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">Сканирование растения</h2>
        <p className="text-sm text-slate-400 mt-1">
          Загрузите фото листа или цветка для распознавания
        </p>
      </div>
    </div>
  );
}