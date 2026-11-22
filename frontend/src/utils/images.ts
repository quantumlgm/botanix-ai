export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 1920;
export const SUPPORTED_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export type ImageErrorCode =
  | "unsupported_type"
  | "heic_not_supported"
  | "too_large"
  | "processing_failed";

export class ImageError extends Error {
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode) {
    super(code);
    this.name = "ImageError";
    this.code = code;
  }
}

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);
const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const JPEG_QUALITIES = [0.85, 0.75, 0.65] as const;

function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex === -1 ? "" : name.slice(dotIndex).toLowerCase();
}

function normalizeFile(file: File): File {
  const mimeType = file.type.toLowerCase();
  const extension = getExtension(file.name);

  if (HEIC_MIME_TYPES.has(mimeType) || HEIC_EXTENSIONS.has(extension)) {
    throw new ImageError("heic_not_supported");
  }

  const extensionMimeType = EXTENSION_TO_MIME[extension];
  if (
    !extensionMimeType ||
    (mimeType && !SUPPORTED_MIME_TYPES.has(mimeType)) ||
    (mimeType && mimeType !== extensionMimeType)
  ) {
    throw new ImageError("unsupported_type");
  }

  if (!mimeType) {
    return new File([file], file.name, {
      type: extensionMimeType,
      lastModified: file.lastModified,
    });
  }

  return file;
}

function fitWithin(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function createCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new ImageError("processing_failed");
  }

  return { canvas, context };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new ImageError("processing_failed"));
      },
      type,
      quality
    );
  });
}

function replaceExtension(name: string, extension: string): string {
  const baseName = name.replace(/\.[^./\\]+$/, "") || "plant";
  return `${baseName}.${extension}`;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new ImageError("processing_failed"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawSource(
  source: CanvasImageSource,
  width: number,
  height: number
): HTMLCanvasElement {
  const size = fitWithin(width, height, MAX_IMAGE_DIMENSION);
  const { canvas, context } = createCanvas(size.width, size.height);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas;
}

async function encodeJpegWithinLimit(
  canvas: HTMLCanvasElement,
  fileName: string
): Promise<File> {
  for (const quality of JPEG_QUALITIES) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);

    if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
      return new File([blob], replaceExtension(fileName, "jpg"), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
  }

  throw new ImageError("too_large");
}

async function compressImageFile(file: File): Promise<File> {
  const image = await loadImage(file);
  const canvas = drawSource(
    image,
    image.naturalWidth,
    image.naturalHeight
  );

  if (file.type === "image/png") {
    const pngBlob = await canvasToBlob(canvas, "image/png");

    if (pngBlob.size <= MAX_IMAGE_SIZE_BYTES) {
      return new File([pngBlob], replaceExtension(file.name, "png"), {
        type: "image/png",
        lastModified: Date.now(),
      });
    }
  }

  return encodeJpegWithinLimit(canvas, file.name);
}

export async function prepareImageForUpload(file: File): Promise<File> {
  const normalizedFile = normalizeFile(file);

  if (normalizedFile.size <= MAX_IMAGE_SIZE_BYTES) {
    return normalizedFile;
  }

  if (normalizedFile.type === "image/webp") {
    throw new ImageError("too_large");
  }

  return compressImageFile(normalizedFile);
}

export async function captureImageFromVideo(
  video: HTMLVideoElement
): Promise<File> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new ImageError("processing_failed");
  }

  const canvas = drawSource(video, video.videoWidth, video.videoHeight);

  return encodeJpegWithinLimit(canvas, `botanix-${Date.now()}.jpg`);
}

export function getImageErrorMessage(error: unknown): string {
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
