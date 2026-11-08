import { categoryGlyphSvg } from "@/lib/categoryGlyphs";
import { SEVERITY_COLORS } from "@/lib/format";
import type { AlertCategory, Severity } from "@/lib/types";

/** The alert's map pin, drawn in the panels, so a row and its pin read as one thing. */
export default function CategoryMark({
  category,
  severity,
}: {
  category: AlertCategory;
  severity: Severity;
}) {
  return (
    <span
      className="category-mark"
      style={{ "--sev": SEVERITY_COLORS[severity] } as React.CSSProperties}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: categoryGlyphSvg(category) }}
    />
  );
}
