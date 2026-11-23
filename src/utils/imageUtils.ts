// Client-side image compression utility so question & option images stay well below Firestore's 1MB document limit

export async function compressImageBlobToDataUrl(
  blob: Blob,
  maxWidth = 900,
  quality = 0.78
): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca blob gambar"));
    };
    reader.onerror = () => reject(reader.error || new Error("Gagal membaca gambar"));
    reader.readAsDataURL(blob);
  });

  // Skip SVG or already tiny images (< 75KB)
  if (blob.type === "image/svg+xml" || rawDataUrl.length < 100_000) {
    return rawDataUrl;
  }

  return compressImageDataUrl(rawDataUrl, maxWidth, quality);
}

export async function compressImageDataUrl(
  dataUrl: string,
  maxWidth = 900,
  quality = 0.78
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
  if (dataUrl.startsWith("data:image/svg+xml") || dataUrl.length < 100_000) {
    return dataUrl;
  }

  if (typeof document === "undefined") return dataUrl;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (!width || !height) {
          resolve(dataUrl);
          return;
        }
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        // Fill white background for transparent PNGs converted to JPEG
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const webp = canvas.toDataURL("image/webp", quality);
        if (webp.startsWith("data:image/webp") && webp.length < dataUrl.length) {
          resolve(webp);
          return;
        }
        const jpeg = canvas.toDataURL("image/jpeg", quality);
        resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function compressImageFile(file: File, maxWidth = 900, quality = 0.78): Promise<string> {
  return compressImageBlobToDataUrl(file, maxWidth, quality);
}
