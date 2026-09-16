import {
  pickWorkingStorageUrl,
  resolveStorageUrl,
  storageObjectUrlCandidates,
} from "@/lib/storageUrl";
import { supabase } from "@/integrations/supabase/client";

const MODEL_BASE = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";
const MATCH_THRESHOLD = 0.45;
const STORAGE_PUBLIC_RE = /\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/;

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

async function loadFaceApi() {
  return import("@vladmandic/face-api");
}

async function ensureFaceModels() {
  if (modelsLoaded) return loadFaceApi();
  if (modelsLoading) {
    await modelsLoading;
    return loadFaceApi();
  }
  modelsLoading = (async () => {
    const faceapi = await loadFaceApi();
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE),
    ]);
    modelsLoaded = true;
  })();
  await modelsLoading;
  return loadFaceApi();
}

function decodeObjectPath(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseStorageObject(rawUrl: string): { bucket: string; path: string } | null {
  const candidates = [rawUrl, resolveStorageUrl(rawUrl) || ""].filter(Boolean);
  for (const candidate of candidates) {
    const m = candidate.match(STORAGE_PUBLIC_RE);
    if (!m) continue;
    return {
      bucket: m[1],
      path: decodeObjectPath(m[2]).split(/[?#]/)[0],
    };
  }
  return null;
}

async function buildProfilePhotoCandidates(rawUrl: string): Promise<string[]> {
  const trimmed = rawUrl.trim();
  const out: string[] = [];
  const add = (url?: string | null) => {
    const v = (url || "").trim();
    if (v && !out.includes(v)) out.push(v);
  };

  add(trimmed);
  add(resolveStorageUrl(trimmed));

  const parsed = parseStorageObject(trimmed);
  if (parsed) {
    for (const url of storageObjectUrlCandidates(parsed.bucket, parsed.path, trimmed)) {
      add(url);
    }
  }

  const working = await pickWorkingStorageUrl(out);
  if (working && !out.includes(working)) out.unshift(working);
  else if (working) {
    out.splice(out.indexOf(working), 1);
    out.unshift(working);
  }

  return out;
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

async function downloadStorageObject(bucket: string, objectPath: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error || !data || data.size === 0) return null;
    return data;
  } catch {
    return null;
  }
}

function loadImageFromSrc(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

async function loadImageFromBlob(blob: Blob): Promise<{ img: HTMLImageElement; cleanup: () => void }> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImageFromSrc(objectUrl, false);
    return {
      img,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (e) {
    URL.revokeObjectURL(objectUrl);
    throw e;
  }
}

/** Load profile photo for face-api (fetch/blob first to avoid storage CORS issues). */
async function loadProfileImageForFaceMatch(
  rawUrl: string
): Promise<{ img: HTMLImageElement; cleanup: () => void }> {
  const candidates = await buildProfilePhotoCandidates(rawUrl);
  if (candidates.length === 0) {
    throw new Error("Upload a profile photo in Profile before marking attendance");
  }

  for (const url of candidates) {
    const blob = await fetchImageBlob(url);
    if (blob) {
      try {
        return await loadImageFromBlob(blob);
      } catch {
        /* try next candidate */
      }
    }
  }

  const parsed = parseStorageObject(rawUrl);
  if (parsed) {
    const downloadPaths = [parsed.path];
    const base = parsed.path.split("/").filter(Boolean).pop();
    if (base && base !== parsed.path) downloadPaths.push(base);

    for (const path of downloadPaths) {
      const blob = await downloadStorageObject(parsed.bucket, path);
      if (blob) {
        try {
          return await loadImageFromBlob(blob);
        } catch {
          /* try next */
        }
      }
    }
  }

  for (const url of candidates) {
    try {
      const img = await loadImageFromSrc(url, true);
      return { img, cleanup: () => {} };
    } catch {
      /* try next */
    }
  }

  for (const url of candidates) {
    try {
      const img = await loadImageFromSrc(url, false);
      return { img, cleanup: () => {} };
    } catch {
      /* try next */
    }
  }

  throw new Error(
    "Could not load profile photo for face match. Open Profile, re-upload a clear front-facing photo, and try again."
  );
}

async function descriptorFromImage(
  faceapi: Awaited<ReturnType<typeof loadFaceApi>>,
  img: HTMLImageElement | HTMLVideoElement
) {
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

/** Capture a JPEG frame from the live camera for profile / face registration upload. */
export async function captureVideoFrameBlob(
  video: HTMLVideoElement,
  quality = 0.92
): Promise<Blob> {
  if (video.readyState < 2) {
    throw new Error("Camera is not ready yet");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture photo from camera");
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture photo from camera"))),
      "image/jpeg",
      quality
    );
  });
}

/** Extract face descriptor from live camera (one-time registration). */
export async function extractFaceDescriptorFromVideo(
  liveVideo: HTMLVideoElement
): Promise<number[]> {
  const faceapi = await ensureFaceModels();
  if (liveVideo.readyState < 2) {
    throw new Error("Camera is not ready yet");
  }
  const desc = await descriptorFromImage(faceapi, liveVideo);
  if (!desc) {
    throw new Error("No face detected. Look at the camera in good lighting.");
  }
  return Array.from(desc);
}

/** Match live face against stored registration descriptor (not profile photo). */
export async function verifyStaffFaceMatchFromDescriptor(
  storedDescriptor: number[] | Float32Array,
  liveVideo: HTMLVideoElement
): Promise<{ score: number; matched: boolean }> {
  const faceapi = await ensureFaceModels();

  if (liveVideo.readyState < 2) {
    throw new Error("Camera is not ready yet");
  }

  const profileDesc =
    storedDescriptor instanceof Float32Array
      ? storedDescriptor
      : new Float32Array(storedDescriptor);

  if (profileDesc.length < 64) {
    throw new Error("Face is not registered yet. Complete face registration first.");
  }

  const liveDesc = await descriptorFromImage(faceapi, liveVideo);
  if (!liveDesc) {
    throw new Error("No face detected. Look at the camera in good lighting.");
  }

  const distance = faceapi.euclideanDistance(profileDesc, liveDesc);
  const score = Math.max(0, Math.min(1, 1 - distance / MATCH_THRESHOLD));
  const matched = distance <= MATCH_THRESHOLD;

  return { score: Math.round(score * 1000) / 1000, matched };
}

/** @deprecated Use verifyStaffFaceMatchFromDescriptor after one-time face registration. */
export async function verifyStaffFaceMatch(
  profileImageUrl: string,
  liveVideo: HTMLVideoElement
): Promise<{ score: number; matched: boolean }> {
  const faceapi = await ensureFaceModels();

  if (!profileImageUrl?.trim()) {
    throw new Error("Upload a profile photo in Profile before marking attendance");
  }

  if (liveVideo.readyState < 2) {
    throw new Error("Camera is not ready yet");
  }

  const { img: profileImg, cleanup } = await loadProfileImageForFaceMatch(profileImageUrl);
  try {
    const [profileDesc, liveDesc] = await Promise.all([
      descriptorFromImage(faceapi, profileImg),
      descriptorFromImage(faceapi, liveVideo),
    ]);

    if (!profileDesc) {
      throw new Error("No face detected in your profile photo. Upload a clear front-facing photo.");
    }
    if (!liveDesc) {
      throw new Error("No face detected. Look at the camera in good lighting.");
    }

    const distance = faceapi.euclideanDistance(profileDesc, liveDesc);
    const score = Math.max(0, Math.min(1, 1 - distance / MATCH_THRESHOLD));
    const matched = distance <= MATCH_THRESHOLD;

    return { score: Math.round(score * 1000) / 1000, matched };
  } finally {
    cleanup();
  }
}

export async function startStaffCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopStaffCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}
