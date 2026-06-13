import { supabase } from "@/integrations/supabase/client";

export interface ContractDocumentLike {
  documento_original_path?: string | null;
  documento_original_nombre?: string | null;
  documento_original_url?: string | null;
  storage_path?: string | null;
  archivo_nombre?: string | null;
  archivo_url?: string | null;
}

export interface ContractDocumentRef {
  storagePath?: string | null;
  url?: string | null;
  fileName?: string | null;
  isLegacy?: boolean;
}

const GENERATED_ARTIFACT_EXTENSIONS = new Set(["md", "markdown", "txt", "rtf"]);

const getExtension = (fileName?: string | null) => {
  if (!fileName || !fileName.includes(".")) return "";
  return fileName.split(".").pop()?.toLowerCase() || "";
};

export function isGeneratedContractArtifact(fileName?: string | null): boolean {
  const extension = getExtension(fileName);
  return GENERATED_ARTIFACT_EXTENSIONS.has(extension);
}

export function resolveOriginalContractDocument(contract: ContractDocumentLike): ContractDocumentRef | null {
  if (contract.documento_original_path) {
    return {
      storagePath: contract.documento_original_path,
      fileName: contract.documento_original_nombre || "Contrato original",
      isLegacy: false,
    };
  }

  if (contract.documento_original_url) {
    return {
      url: contract.documento_original_url,
      fileName: contract.documento_original_nombre || "Contrato original",
      isLegacy: false,
    };
  }

  // Compatibilidad con contratos subidos antes de separar campos:
  // si archivo_nombre no parece un artefacto generado, se trata como documento original.
  if (contract.archivo_nombre && !isGeneratedContractArtifact(contract.archivo_nombre)) {
    if (contract.storage_path) {
      return {
        storagePath: contract.storage_path,
        fileName: contract.archivo_nombre,
        isLegacy: true,
      };
    }

    if (contract.archivo_url) {
      return {
        url: contract.archivo_url,
        fileName: contract.archivo_nombre,
        isLegacy: true,
      };
    }
  }

  return null;
}

export function resolveGeneratedContractDocument(contract: ContractDocumentLike): ContractDocumentRef | null {
  if (!contract.archivo_nombre || !isGeneratedContractArtifact(contract.archivo_nombre)) {
    return null;
  }

  if (contract.storage_path) {
    return {
      storagePath: contract.storage_path,
      fileName: contract.archivo_nombre,
      isLegacy: false,
    };
  }

  if (contract.archivo_url) {
    return {
      url: contract.archivo_url,
      fileName: contract.archivo_nombre,
      isLegacy: false,
    };
  }

  return null;
}

/**
 * Generates a temporary signed URL for a contract document stored in Storage.
 */
export async function getContractDocumentUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;

  // Bucket privado: siempre URL firmada (1h).
  const { data, error } = await supabase.storage
    .from("contratos")
    .createSignedUrl(storagePath, 3600);

  if (error) {
    console.error("Error creating signed URL for contract:", error);
    return null;
  }

  return data.signedUrl;
}

const OPEN_URL_WINDOW_FEATURES = "noopener,noreferrer";

const openBlankTab = (): Window | null => {
  const tab = window.open("about:blank", "_blank");
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      // Ignore opener assignment failures.
    }
  }
  return tab;
};

const navigateTabToUrl = (targetTab: Window | null, url: string) => {
  const safeUrl = encodeURI(url);

  if (targetTab && !targetTab.closed) {
    targetTab.location.replace(safeUrl);
    return;
  }

  const popup = window.open(safeUrl, "_blank", OPEN_URL_WINDOW_FEATURES);
  if (!popup) {
    // Last resort when popup blockers reject async window.open calls.
    window.location.assign(safeUrl);
  }
};

export async function openContractDocument(storagePath: string | null | undefined): Promise<boolean> {
  if (!storagePath) return false;

  const targetTab = openBlankTab();
  const url = await getContractDocumentUrl(storagePath);
  if (!url) {
    targetTab?.close();
    return false;
  }

  navigateTabToUrl(targetTab, url);
  return true;
}

export async function openContractDocumentFromRef(documentRef: ContractDocumentRef | null | undefined): Promise<boolean> {
  if (!documentRef) return false;

  const targetTab = openBlankTab();

  if (documentRef.storagePath) {
    const url = await getContractDocumentUrl(documentRef.storagePath);
    if (!url) {
      targetTab?.close();
      return false;
    }

    navigateTabToUrl(targetTab, url);
    return true;
  }

  if (documentRef.url) {
    navigateTabToUrl(targetTab, documentRef.url);
    return true;
  }

  targetTab?.close();
  return false;
}
