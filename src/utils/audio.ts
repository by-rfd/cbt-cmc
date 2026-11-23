/**
 * Web Audio API synthesizer for the Anti-Cheat alarm.
 * Generates an ear-catching warning buzzer sound completely client-side.
 */
let audioCtx: AudioContext | null = null;

export function playAlertAlarm() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const duration = 0.8; // seconds
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(150, audioCtx.currentTime); // low alarm pitch
    osc1.frequency.linearRampToValueAtTime(300, audioCtx.currentTime + duration * 0.5);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc2.frequency.linearRampToValueAtTime(640, audioCtx.currentTime + duration);

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + duration);
    osc2.stop(audioCtx.currentTime + duration);
  } catch (err) {
    console.warn("Audio Context alert failed to play: ", err);
  }
}
