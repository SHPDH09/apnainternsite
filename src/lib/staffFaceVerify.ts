const MODEL_BASE = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";
const MATCH_THRESHOLD = 0.45;

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

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load profile photo for face match"));
    img.src = url;
  });
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

/** Returns match score 0–1 (higher = better match). */
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

  const profileImg = await loadImageElement(profileImageUrl);
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
