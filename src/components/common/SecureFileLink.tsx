import { ComponentType, MouseEvent, ReactNode } from "react";
import { openSecureFile } from "@/lib/storage/secureStorage";

interface Props {
  bucket?: string | null;
  path?: string | null;
  fallbackUrl?: string | null;
  className?: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
  /** Icono opcional para usos compactos */
  icon?: ComponentType<any>;
  iconSize?: number;
  onClick?: (e: MouseEvent) => void;
}

/**
 * Botón que abre un fichero de Storage resolviendo URL firmada al vuelo.
 * Reemplaza patrones `<a href={archivo_url} target="_blank">`.
 */
export function SecureFileLink({
  bucket,
  path,
  fallbackUrl,
  className,
  title,
  ariaLabel,
  children,
  icon: Icon,
  iconSize = 14,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={ariaLabel}
      onClick={async (e) => {
        e.stopPropagation();
        onClick?.(e);
        await openSecureFile({ bucket, path, fallbackUrl });
      }}
    >
      {Icon ? <Icon size={iconSize} /> : children}
    </button>
  );
}

export default SecureFileLink;