import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type BrandSize = "sm" | "md" | "lg";

interface BrandProps {
  /** Visual size of the brand lockup. `md` is the default app size; `lg` matches the landing header. */
  size?: BrandSize;
  /** Wrap the lockup in a Link to `to` (defaults to "/"). Set to `false` to render as a plain div. */
  to?: string | false;
  /** Hide the "CapitalRent" wordmark and render only the isotype. */
  symbolOnly?: boolean;
  /** Optional tagline rendered under the wordmark (only shown when `showTagline` is true). */
  tagline?: string;
  showTagline?: boolean;
  className?: string;
}

const SIZES: Record<BrandSize, { img: string; text: string; gap: string; tagline: string }> = {
  sm: {
    img: "h-7 w-auto md:h-8",
    text: "text-[1.05rem] md:text-[1.1rem]",
    gap: "gap-2",
    tagline: "text-[10px]",
  },
  md: {
    img: "h-9 w-auto md:h-10",
    text: "text-[1.35rem] md:text-[1.4rem]",
    gap: "gap-2.5",
    tagline: "text-[10px]",
  },
  lg: {
    img: "h-[42px] w-auto md:h-[48px]",
    text: "text-[1.85rem] md:text-[1.95rem]",
    gap: "gap-2.5",
    tagline: "text-[11px]",
  },
};

/**
 * Unified CapitalRent brand lockup.
 *
 * Composition validated on the landing header:
 *   [isotype] Capital(foreground)Rent(primary)
 *
 * This is the only allowed brand representation across the app.
 * Do not inline `<img src="/capitalrent-*.png">` + "CapitalRent" text manually.
 */
export function Brand({
  size = "md",
  to = "/",
  symbolOnly = false,
  tagline = "Control de activos inmobiliarios",
  showTagline = false,
  className,
}: BrandProps) {
  const s = SIZES[size];

  const inner = (
    <>
      <img
        src="/capitalrent-symbol.png"
        alt=""
        className={cn("object-contain shrink-0", s.img)}
      />
      {!symbolOnly && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-bold tracking-[-0.03em] leading-none",
              s.text,
            )}
          >
            <span className="text-foreground">Capital</span>
            <span className="text-primary">Rent</span>
          </span>
          {showTagline && tagline && (
            <span
              className={cn(
                "mt-1 text-muted-foreground/70 tracking-wide",
                s.tagline,
              )}
            >
              {tagline}
            </span>
          )}
        </span>
      )}
    </>
  );

  const wrapperClass = cn(
    "inline-flex items-center shrink-0",
    s.gap,
    className,
  );

  if (to === false) {
    return (
      <div className={wrapperClass} aria-label="CapitalRent">
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className={cn(wrapperClass, "transition-transform hover:scale-[1.01]")}
      aria-label="CapitalRent"
    >
      {inner}
    </Link>
  );
}

export default Brand;