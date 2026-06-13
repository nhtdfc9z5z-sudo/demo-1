/**
 * File validation utility to filter unsupported formats before upload.
 * Prevents unnecessary API/storage calls.
 */

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Accepted MIME types and extensions by upload context */
const ALLOWED_FORMATS: Record<string, { extensions: string[]; mimeTypes: string[]; label: string }> = {
  photo: {
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
    label: "Imágenes (JPG, PNG, WebP, GIF, HEIC)",
  },
  document: {
    extensions: [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp", ".xls", ".xlsx", ".txt", ".csv"],
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/png", "image/webp",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", "text/csv",
    ],
    label: "Documentos (PDF, Word, Excel, imágenes, texto)",
  },
  contract: {
    extensions: [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"],
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/png",
    ],
    label: "Contratos (PDF, Word, imágenes)",
  },
  template: {
    extensions: [".pdf", ".doc", ".docx", ".pages", ".odt", ".txt", ".md", ".text"],
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.oasis.opendocument.text",
      "text/plain", "text/markdown",
    ],
    label: "Plantillas (PDF, Word, Pages, ODT, texto)",
  },
  evidence: {
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".mp4", ".mov", ".heic", ".heif"],
    mimeTypes: [
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
      "application/pdf",
      "video/mp4", "video/quicktime",
    ],
    label: "Evidencias (imágenes, PDF, vídeo)",
  },
  dni: {
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic", ".heif"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif"],
    label: "DNI (imagen o PDF)",
  },
};

export type FileContext = keyof typeof ALLOWED_FORMATS;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file before upload.
 * @param file - The file to validate
 * @param context - The upload context (photo, document, contract, template, evidence, dni)
 * @param maxSizeMb - Optional max size override in MB (default 20MB)
 */
export function validateFile(file: File, context: FileContext, maxSizeMb?: number): FileValidationResult {
  const maxBytes = (maxSizeMb ?? MAX_FILE_SIZE_MB) * 1024 * 1024;
  const config = ALLOWED_FORMATS[context];

  if (!config) {
    return { valid: true }; // Unknown context, allow
  }

  // Check file size
  if (file.size > maxBytes) {
    const sizeMb = maxSizeMb ?? MAX_FILE_SIZE_MB;
    return {
      valid: false,
      error: `El archivo supera el límite de ${sizeMb}MB. Tamaño actual: ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
    };
  }

  // Check empty file
  if (file.size === 0) {
    return { valid: false, error: "El archivo está vacío." };
  }

  // Check extension
  const fileName = file.name.toLowerCase();
  const ext = "." + (fileName.split(".").pop() || "");
  const hasValidExtension = config.extensions.includes(ext);

  // Check MIME type (fallback: some browsers don't set type correctly)
  const hasValidMime = !file.type || config.mimeTypes.includes(file.type);

  if (!hasValidExtension) {
    return {
      valid: false,
      error: `Formato no soportado (${ext}). Formatos aceptados: ${config.label}.`,
    };
  }

  // If MIME is set but doesn't match, warn but still allow if extension matches
  // (some OS/browsers misreport MIME types)

  return { valid: true };
}

/**
 * Validates a file and shows a toast if invalid.
 * Returns true if the file is valid.
 */
export function validateFileWithToast(
  file: File,
  context: FileContext,
  toast: (opts: { title: string; description: string; variant?: "destructive" }) => void,
  maxSizeMb?: number,
): boolean {
  const result = validateFile(file, context, maxSizeMb);
  if (!result.valid && result.error) {
    toast({ title: "Archivo no válido", description: result.error, variant: "destructive" });
  }
  return result.valid;
}

/** Get the accept string for an input[type=file] by context */
export function getAcceptString(context: FileContext): string {
  const config = ALLOWED_FORMATS[context];
  if (!config) return "";
  return [...config.extensions, ...config.mimeTypes].join(",");
}
