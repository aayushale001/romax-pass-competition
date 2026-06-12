"use client";

type ResizeImageFileOptions = {
  maxDimension?: number;
  quality?: number;
  maxDataUrlLength?: number;
  maxSourceBytes?: number;
  maxPixels?: number;
  outputType?: "image/webp" | "image/jpeg";
  backgroundColor?: string;
};

const defaultOptions = {
  maxDimension: 1000,
  quality: 0.78,
  maxDataUrlLength: 520_000,
  maxPixels: 16_000_000,
  outputType: "image/webp" as const,
  backgroundColor: "#ffffff",
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read this image."));
      }
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to prepare this image."));
    image.src = source;
  });
}

function renderImageToDataUrl({
  image,
  width,
  height,
  outputType,
  quality,
  backgroundColor,
}: {
  image: HTMLImageElement;
  width: number;
  height: number;
  outputType: "image/webp" | "image/jpeg";
  quality: number;
  backgroundColor: string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image compression is not available in this browser.");
  }

  if (outputType === "image/jpeg") {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL(outputType, quality);
  if (outputType === "image/webp" && !dataUrl.startsWith("data:image/webp")) {
    return renderImageToDataUrl({
      image,
      width,
      height,
      outputType: "image/jpeg",
      quality,
      backgroundColor,
    });
  }

  return dataUrl;
}

export async function resizeImageFileToDataUrl(
  file: File,
  options: ResizeImageFileOptions = {},
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Upload an image file.");
  }

  if (options.maxSourceBytes && file.size > options.maxSourceBytes) {
    throw new Error("Image must be smaller before upload.");
  }

  const settings = {
    ...defaultOptions,
    ...options,
  };
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;

  if (!naturalWidth || !naturalHeight) {
    throw new Error("Unable to measure this image.");
  }

  if (naturalWidth * naturalHeight > settings.maxPixels) {
    throw new Error("Image dimensions are too large.");
  }

  let maxDimension = settings.maxDimension;
  let quality = settings.quality;
  let bestDataUrl = source;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(
      1,
      maxDimension / Math.max(naturalWidth, naturalHeight),
    );
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    bestDataUrl = renderImageToDataUrl({
      image,
      width,
      height,
      outputType: settings.outputType,
      quality,
      backgroundColor: settings.backgroundColor,
    });

    if (bestDataUrl.length <= settings.maxDataUrlLength) {
      return bestDataUrl;
    }

    if (quality > 0.52) {
      quality = Math.max(0.52, quality - 0.1);
    } else {
      maxDimension = Math.max(360, Math.floor(maxDimension * 0.82));
    }
  }

  return bestDataUrl;
}
