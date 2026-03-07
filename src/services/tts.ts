/**
 * TTS (Text-to-Speech) Service
 * Uses browser-native speechSynthesis API
 */

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices();
}

export function speak(text: string, voiceName?: string): void {
  if (!('speechSynthesis' in window)) return;

  // Stop any current speech
  stop();

  // Strip markdown/HTML for cleaner TTS
  const clean = text
    .replace(/<[^>]+>/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();

  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);

  if (voiceName) {
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    if (voice) utterance.voice = voice;
  }

  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  speechSynthesis.speak(utterance);
}

export function stop(): void {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  if (!('speechSynthesis' in window)) return false;
  return speechSynthesis.speaking;
}

export function isSupported(): boolean {
  return 'speechSynthesis' in window;
}

// Preload voices (some browsers load them lazily)
export function preloadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
  });
}
