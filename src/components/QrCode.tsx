import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface QrCodeProps {
  value: string;
  size?: number;
  /** Error correction: L for dense data (backups), M default, H for posters with a logo. */
  level?: "L" | "M" | "Q" | "H";
  label?: string;
  className?: string;
}

/** Renders a QR code as an inline SVG (crisp on screen and in print). */
export function QrCode({ value, size = 200, level = "M", label, className }: QrCodeProps) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", errorCorrectionLevel: level, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [value, level]);

  return (
    <div
      className={`qr-code ${className ?? ""}`}
      role="img"
      aria-label={label ?? value}
      style={{ width: size, height: size, background: "#fff", flex: "none" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** PNG data URL for downloads and canvas drawing. */
export function qrDataUrl(value: string, size = 600, level: "L" | "M" | "Q" | "H" = "M"): Promise<string> {
  return QRCode.toDataURL(value, { width: size, errorCorrectionLevel: level, margin: 2 });
}
