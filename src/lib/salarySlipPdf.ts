import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { SALARY_SLIP_CAPTURE_WIDTH_PX } from "@/lib/salarySlipFormat";

const PDF_MARGIN_MM = 8;
const CAPTURE_SCALE = 2.5;

function absoluteImageUrl(src: string): string {
  if (!src) return src;
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) return src;
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

async function inlineImagesForCapture(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  );
  await Promise.all(
    imgs.map(async (img) => {
      const url = absoluteImageUrl(img.getAttribute("src") || img.src || "");
      if (!url || url.startsWith("data:")) return;
      await new Promise<void>((resolve) => {
        const loader = new Image();
        loader.crossOrigin = "anonymous";
        loader.onload = () => {
          try {
            const c = document.createElement("canvas");
            c.width = loader.naturalWidth;
            c.height = loader.naturalHeight;
            const ctx = c.getContext("2d");
            if (ctx && c.width > 0 && c.height > 0) {
              ctx.drawImage(loader, 0, 0);
              img.src = c.toDataURL("image/png");
            }
          } catch {
            /* keep original */
          }
          resolve();
        };
        loader.onerror = () => resolve();
        loader.src = url;
      });
    })
  );
}

export function prepareSalarySlipForCapture(root: HTMLElement): void {
  root.style.width = `${SALARY_SLIP_CAPTURE_WIDTH_PX}px`;
  root.style.maxWidth = `${SALARY_SLIP_CAPTURE_WIDTH_PX}px`;
  root.style.minWidth = `${SALARY_SLIP_CAPTURE_WIDTH_PX}px`;
  root.style.margin = "0";
  root.style.boxShadow = "none";
  root.style.overflow = "visible";
  root.style.background = "#ffffff";
  root.style.boxSizing = "border-box";

  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const o = window.getComputedStyle(el).overflow;
    if (o === "hidden" || o === "clip") el.style.overflow = "visible";
  });
}

function mountCloneForCapture(element: HTMLElement): { wrapper: HTMLDivElement; target: HTMLElement } {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:fixed;left:-10000px;top:0;z-index:-1;overflow:visible;background:#ffffff;";
  wrapper.style.width = `${SALARY_SLIP_CAPTURE_WIDTH_PX}px`;

  const clone = element.cloneNode(true) as HTMLElement;
  prepareSalarySlipForCapture(clone);
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return { wrapper, target: clone };
}

function addSinglePageFit(
  pdf: jsPDF,
  imgData: string,
  canvas: HTMLCanvasElement,
  marginMm: number
): void {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const innerW = pageW - 2 * marginMm;
  const innerH = pageH - 2 * marginMm;
  const aspect = canvas.width / Math.max(canvas.height, 1);

  let dw = innerW;
  let dh = dw / aspect;
  if (dh > innerH) {
    dh = innerH;
    dw = dh * aspect;
  }
  const x = marginMm + (innerW - dw) / 2;
  const y = marginMm;
  pdf.addImage(imgData, "PNG", x, y, dw, dh, undefined, "FAST");
}

export async function downloadSalarySlipPdf(
  sourceElement: HTMLElement,
  fileName: string
): Promise<void> {
  let wrapper: HTMLDivElement | null = null;
  const target = (() => {
    const mount = mountCloneForCapture(sourceElement);
    wrapper = mount.wrapper;
    return mount.target;
  })();

  try {
    prepareSalarySlipForCapture(target);
    await inlineImagesForCapture(target);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(target, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 30000,
      width: SALARY_SLIP_CAPTURE_WIDTH_PX,
      windowWidth: SALARY_SLIP_CAPTURE_WIDTH_PX,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    addSinglePageFit(pdf, canvas.toDataURL("image/png"), canvas, PDF_MARGIN_MM);
    pdf.save(fileName);
  } finally {
    if (wrapper?.parentNode) wrapper.parentNode.removeChild(wrapper);
  }
}
