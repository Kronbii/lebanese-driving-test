import { qrDataUrl } from "../../components/QrCode";

/** Everything drawn on a 1080x1920 story card (Instagram/TikTok/WhatsApp status size). */
export interface StoryCardSpec {
  /** School or app name shown at the top. */
  brand: string;
  title: string;
  /** Ring fill, 0..1. */
  ringValue: number;
  ringMain: string;
  ringSub: string;
  pill?: { text: string; tone: "success" | "danger" | "neutral" };
  rows: { label: string; value: string }[];
  cta: string;
  /** Link printed at the bottom (also encoded in the QR code). */
  link: string;
  primary: string;
  accent: string;
  dir: "rtl" | "ltr";
}

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
const FONT = '"Cairo", "Noto Kufi Arabic", "Segoe UI", system-ui, Tahoma, Arial, sans-serif';

function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (value >> shift) & 255;
    const next = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

async function fontsReady(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`900 120px ${FONT}`),
        document.fonts.load(`700 48px ${FONT}`)
      ]).then(() => document.fonts.ready),
      new Promise((resolve) => window.setTimeout(resolve, 2500))
    ]);
  } catch {
    // Fall back to system fonts.
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrinks the font until the text fits the width. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number) {
  let current = size;
  ctx.font = `${weight} ${current}px ${FONT}`;
  while (current > 20 && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = `${weight} ${current}px ${FONT}`;
  }
}

/** Draws the card and returns it as a PNG blob. */
export async function renderStoryCard(spec: StoryCardSpec): Promise<Blob> {
  await fontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.direction = spec.dir;
  const W = STORY_WIDTH;
  const center = W / 2;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, W, STORY_HEIGHT);
  gradient.addColorStop(0, shade(spec.primary, 0.08));
  gradient.addColorStop(0.55, shade(spec.primary, -0.25));
  gradient.addColorStop(1, shade(spec.accent, -0.45));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, STORY_HEIGHT);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.arc(W - 60, 160, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, STORY_HEIGHT - 260, 320, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Brand and title
  ctx.fillStyle = "#ffffff";
  fitText(ctx, spec.brand, 800, 60, W - 160);
  ctx.fillText(spec.brand, center, 170);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  fitText(ctx, spec.title, 600, 44, W - 160);
  ctx.fillText(spec.title, center, 255);

  // Score ring
  const ringY = 640;
  const radius = 270;
  ctx.lineWidth = 50;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(center, ringY, radius, 0, Math.PI * 2);
  ctx.stroke();
  const value = Math.max(0, Math.min(1, spec.ringValue));
  if (value > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(center, ringY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * value);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  fitText(ctx, spec.ringMain, 900, 150, radius * 1.5);
  ctx.fillText(spec.ringMain, center, ringY - 20);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  fitText(ctx, spec.ringSub, 700, 58, radius * 1.5);
  ctx.fillText(spec.ringSub, center, ringY + 105);

  // Verdict pill
  if (spec.pill) {
    ctx.font = `800 52px ${FONT}`;
    const width = Math.min(W - 160, ctx.measureText(spec.pill.text).width + 120);
    const colors = { success: "#16a34a", danger: "#dc2626", neutral: "rgba(255,255,255,0.2)" };
    ctx.fillStyle = colors[spec.pill.tone];
    roundRect(ctx, center - width / 2, 960, width, 100, 50);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    fitText(ctx, spec.pill.text, 800, 52, width - 60);
    ctx.fillText(spec.pill.text, center, 1012);
  }

  // Detail rows
  const rows = spec.rows.slice(0, 4);
  if (rows.length) {
    const top = 1110;
    const rowHeight = 96;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, 90, top, W - 180, rows.length * rowHeight + 40, 36);
    ctx.fill();
    const startX = spec.dir === "rtl" ? W - 140 : 140;
    const endX = spec.dir === "rtl" ? 140 : W - 140;
    rows.forEach((row, index) => {
      const y = top + 20 + rowHeight * index + rowHeight / 2;
      ctx.textAlign = spec.dir === "rtl" ? "right" : "left";
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      fitText(ctx, row.label, 600, 40, W / 2 - 140);
      ctx.fillText(row.label, startX, y);
      ctx.textAlign = spec.dir === "rtl" ? "left" : "right";
      ctx.fillStyle = "#ffffff";
      fitText(ctx, row.value, 800, 46, W / 2 - 160);
      ctx.fillText(row.value, endX, y);
    });
    ctx.textAlign = "center";
  }

  // QR + call to action
  const qr = await qrDataUrl(spec.link, 440, "M")
    .then(loadImage)
    .catch(() => null);
  if (qr) {
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, center - 125, 1495, 250, 250, 24);
    ctx.fill();
    ctx.drawImage(qr, center - 115, 1505, 230, 230);
  }
  ctx.fillStyle = "#ffffff";
  fitText(ctx, spec.cta, 800, 48, W - 160);
  ctx.fillText(spec.cta, center, 1800);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.direction = "ltr";
  const link = spec.link.replace(/^https?:\/\//, "");
  fitText(ctx, link, 600, 36, W - 160);
  ctx.fillText(link, center, 1865);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png");
  });
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/** Native share sheet with the image when supported (mobile), otherwise a PNG download. */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  text: string,
  title: string
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title });
      return "shared";
    } catch (error) {
      if ((error as Error).name === "AbortError") return "cancelled";
      // Fall through to download.
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
