/** Convert camera capture blob to base64 for Vercel staff-register-face API. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const out = typeof reader.result === "string" ? reader.result : "";
      if (!out) {
        reject(new Error("Could not read photo from camera"));
        return;
      }
      resolve(out);
    };
    reader.onerror = () => reject(new Error("Could not read photo from camera"));
    reader.readAsDataURL(blob);
  });
}
