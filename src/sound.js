export function createSoundscape() {
  let audio;
  let gain;
  let active = false;

  function start() {
    audio = new AudioContext();
    gain = audio.createGain();
    gain.gain.value = 0;
    gain.connect(audio.destination);

    const length = audio.sampleRate * 4;
    const breeze = audio.createBuffer(1, length, audio.sampleRate);
    const samples = breeze.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.03 * (Math.random() * 2 - 1)) / 1.03;
      samples[i] = last * 2 * Math.pow(Math.sin(Math.PI * i / length), 0.5);
    }
    const source = audio.createBufferSource();
    source.buffer = breeze;
    source.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 680;
    source.connect(filter).connect(gain);
    source.start();
  }

  return {
    async toggle() {
      try {
        if (!audio) start();
        if (audio.state === 'suspended') await audio.resume();
        active = !active;
        gain.gain.setTargetAtTime(active ? 0.22 : 0, audio.currentTime, 0.2);
      } catch {
        active = false;
      }
      return active;
    },
    cue() {
      if (!active) return;
      const at = audio.currentTime;
      for (const [note, delay] of [[349.23, 0], [523.25, 0.05]]) {
        const oscillator = audio.createOscillator();
        const envelope = audio.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = note;
        envelope.gain.setValueAtTime(0, at + delay);
        envelope.gain.linearRampToValueAtTime(0.07, at + delay + 0.028);
        envelope.gain.exponentialRampToValueAtTime(0.001, at + delay + 0.34);
        oscillator.connect(envelope).connect(gain);
        oscillator.start(at + delay);
        oscillator.stop(at + delay + 0.35);
      }
    },
  };
}
