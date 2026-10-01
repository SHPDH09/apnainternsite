import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechFieldCapture(lang = "en-IN") {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(false);
  const finalPartsRef = useRef<string[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
  }, []);

  const resetTranscript = useCallback(() => {
    finalPartsRef.current = [];
    setTranscript("");
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return false;

    stopListening();
    resetTranscript();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript?.trim() || "";
        if (!piece) continue;
        if (result.isFinal) {
          finalPartsRef.current.push(piece);
        } else {
          interim = interim ? `${interim} ${piece}` : piece;
        }
      }
      const combined = [...finalPartsRef.current, interim].filter(Boolean).join(" ");
      setTranscript(combined);
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      return true;
    } catch {
      return false;
    }
  }, [lang, resetTranscript, stopListening]);

  /** Full phrase captured (final segments preferred). */
  const getCapturedText = useCallback((): string => {
    const fromFinal = finalPartsRef.current.join(" ").trim();
    return fromFinal || transcript.trim();
  }, [transcript]);

  useEffect(() => () => stopListening(), [stopListening]);

  return {
    supported,
    listening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    getCapturedText,
  };
}
