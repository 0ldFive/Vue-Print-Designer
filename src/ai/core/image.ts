import { uuidv4 } from "@/utils/uuid";
import type { AiImageAttachment } from "../types";

export const MAX_IMAGES = 4;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type AiImageErrorCode =
  "imageTooLarge" | "imageLimitReached" | "imageUnsupported";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const compressImage = async (dataUrl: string) => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image load failed"));
    el.src = dataUrl;
  });

  const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
  if (scale >= 1 && dataUrl.length < 400_000) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
};

export const pickImageFiles = async (
  files: File[],
  current: AiImageAttachment[],
): Promise<{ images: AiImageAttachment[]; error?: AiImageErrorCode }> => {
  const images = [...current];
  let error: AiImageErrorCode | undefined;

  for (const file of files) {
    if (!IMAGE_TYPES.includes(file.type)) {
      error = "imageUnsupported";
      continue;
    }
    if (images.length >= MAX_IMAGES) {
      error = "imageLimitReached";
      break;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      error = "imageTooLarge";
      continue;
    }
    try {
      const dataUrl = await compressImage(await fileToDataUrl(file));
      images.push({ id: uuidv4(), name: file.name, dataUrl });
    } catch {
      error = "imageUnsupported";
    }
  }

  return { images, error };
};
