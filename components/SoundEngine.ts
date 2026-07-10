// Web Audio API Synthesized Porsche 911 GT2 RS Engine Sound Generator

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isStarted = false;
  private isMuted = false;

  // Engine Rumble nodes
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private noiseNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Turbocharger hiss nodes
  private turboNoise: ScriptProcessorNode | null = null;
  private turboFilter: BiquadFilterNode | null = null;
  private turboGain: GainNode | null = null;

  // Horn nodes
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;

  // Brake squeal nodes
  private brakeOsc: OscillatorNode | null = null;
  private brakeFilter: BiquadFilterNode | null = null;
  private brakeGain: GainNode | null = null;

  // Blinker / Indicator nodes
  private blinkerInterval: any = null;
  private isBlinking = false;

  // Parameters
  private targetRPM = 0; // 0 to 1 (throttle mapping)
  private currentRPM = 0; // smoothed RPM
  private animationFrameId: any = null;

  constructor() {
    // Audio will initialize on user click/interaction
  }

  public init() {
    if (this.ctx) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.setupEngineNodes();
      this.setupTurboNodes();
      this.setupHornNodes();
      this.setupBrakeNodes();
      this.startLoop();
      this.isStarted = true;
    } catch (e) {
      console.error("Failed to initialize AudioContext", e);
    }
  }

  private setupEngineNodes() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // We combine a sawtooth and triangle oscillator to create a throaty combustion sound
    this.osc1 = ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc1.frequency.setValueAtTime(25, ctx.currentTime);

    this.osc2 = ctx.createOscillator();
    this.osc2.type = "triangle";
    this.osc2.frequency.setValueAtTime(12.5, ctx.currentTime); // sub-harmonic octave

    // Filter to remove harsh highs, leaving a low rumble
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.setValueAtTime(120, ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(2, ctx.currentTime);

    // Gain node for overall engine volume
    this.engineGain = ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0, ctx.currentTime); // start silent

    // Noise to add combustion unevenness
    try {
      // ScriptProcessor is deprecated but widely supported. Good fallback.
      this.noiseNode = ctx.createScriptProcessor(4096, 1, 1);
      this.noiseNode.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < e.outputBuffer.length; i++) {
          // Low-frequency noise amplitude modulation to simulate cylinder fires
          output[i] = (Math.random() * 2 - 1) * 0.15;
        }
      };
      
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(15, ctx.currentTime);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, ctx.currentTime);

      this.noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      // Modulate oscillator frequencies slightly with noise
      if (this.osc1 && this.osc2) {
        noiseGain.connect(this.osc1.frequency);
        noiseGain.connect(this.osc2.frequency);
      }
    } catch (e) {
      console.warn("Could not create ScriptProcessor noise modulation:", e);
    }

    this.osc1.connect(this.engineFilter);
    this.osc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);

    this.osc1.start();
    this.osc2.start();
  }

  private setupTurboNodes() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Turbo hiss noise generator
    try {
      this.turboNoise = ctx.createScriptProcessor(4096, 1, 1);
      this.turboNoise.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < e.outputBuffer.length; i++) {
          output[i] = Math.random() * 2 - 1; // pure white noise
        }
      };

      this.turboFilter = ctx.createBiquadFilter();
      this.turboFilter.type = "bandpass";
      this.turboFilter.frequency.setValueAtTime(3000, ctx.currentTime);
      this.turboFilter.Q.setValueAtTime(1.5, ctx.currentTime);

      this.turboGain = ctx.createGain();
      this.turboGain.gain.setValueAtTime(0.0, ctx.currentTime); // start silent

      this.turboNoise.connect(this.turboFilter);
      this.turboFilter.connect(this.turboGain);
      this.turboGain.connect(ctx.destination);
    } catch (e) {
      console.warn("Could not setup turbo sound nodes", e);
    }
  }

  private setupHornNodes() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Dual tone horn typical of European sports cars (around 400Hz and 480Hz)
    this.hornOsc1 = ctx.createOscillator();
    this.hornOsc1.type = "sine";
    this.hornOsc1.frequency.setValueAtTime(410, ctx.currentTime);

    this.hornOsc2 = ctx.createOscillator();
    this.hornOsc2.type = "sine";
    this.hornOsc2.frequency.setValueAtTime(475, ctx.currentTime);

    this.hornGain = ctx.createGain();
    this.hornGain.gain.setValueAtTime(0.0, ctx.currentTime);

    this.hornOsc1.connect(this.hornGain);
    this.hornOsc2.connect(this.hornGain);
    this.hornGain.connect(ctx.destination);

    this.hornOsc1.start();
    this.hornOsc2.start();
  }

  private setupBrakeNodes() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // High pitched brake squeal (approx 4kHz)
    this.brakeOsc = ctx.createOscillator();
    this.brakeOsc.type = "sine";
    this.brakeOsc.frequency.setValueAtTime(3900, ctx.currentTime);

    // Filter to shape squeal
    this.brakeFilter = ctx.createBiquadFilter();
    this.brakeFilter.type = "bandpass";
    this.brakeFilter.frequency.setValueAtTime(3900, ctx.currentTime);
    this.brakeFilter.Q.setValueAtTime(15, ctx.currentTime);

    this.brakeGain = ctx.createGain();
    this.brakeGain.gain.setValueAtTime(0.0, ctx.currentTime);

    this.brakeOsc.connect(this.brakeFilter);
    this.brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(ctx.destination);

    this.brakeOsc.start();
  }

  private startLoop() {
    const updateEngineSound = () => {
      if (!this.ctx) return;

      // Smooth RPM transition
      const k = 0.08; // smoothing factor
      this.currentRPM += (this.targetRPM - this.currentRPM) * k;

      const time = this.ctx.currentTime;
      const isMuted = this.isMuted;

      if (this.osc1 && this.osc2 && this.engineFilter && this.engineGain) {
        // Frequency shifts with RPM:
        // Idle is ~26Hz (osc1), peak throttle is ~110Hz
        const baseFreq = 26 + this.currentRPM * 80;
        this.osc1.frequency.setValueAtTime(baseFreq, time);
        this.osc2.frequency.setValueAtTime(baseFreq * 0.5, time); // sub octave

        // Filter opens up as engine revs
        const filterFreq = 120 + this.currentRPM * 280;
        this.engineFilter.frequency.setValueAtTime(filterFreq, time);

        // Volume increases slightly under load (RPM)
        const targetVol = isMuted ? 0.0 : 0.08 + this.currentRPM * 0.15;
        this.engineGain.gain.setValueAtTime(targetVol, time);
      }

      if (this.turboFilter && this.turboGain) {
        // Turbo spools up with delay and peak volume at high RPM
        const turboTarget = this.currentRPM > 0.4 ? (this.currentRPM - 0.4) * 0.018 : 0;
        const turboFreq = 2800 + this.currentRPM * 2200; // hiss increases pitch
        
        this.turboFilter.frequency.setValueAtTime(turboFreq, time);
        this.turboGain.gain.setValueAtTime(isMuted ? 0 : turboTarget, time);
      }

      this.animationFrameId = requestAnimationFrame(updateEngineSound);
    };

    updateEngineSound();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && this.ctx.state === "suspended" && !muted) {
      this.ctx.resume();
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  public setThrottle(val: number) {
    // val is 0 to 100, maps to 0.0 to 1.0 RPM
    this.targetRPM = Math.max(0, Math.min(100, val)) / 100;
  }

  public setBraking(active: boolean) {
    if (!this.ctx || this.isMuted) return;
    const time = this.ctx.currentTime;

    if (this.brakeGain) {
      // Brake squeal happens only at higher speeds (virtual simulation)
      const targetBrakeVolume = active && this.currentRPM > 0.15 ? 0.003 : 0.0;
      this.brakeGain.gain.setTargetAtTime(targetBrakeVolume, time, 0.05);

      // Randomly modulate brake squeal frequency slightly to make it sound realistic
      if (this.brakeOsc && active) {
        const jitter = 3900 + Math.sin(time * 30) * 150;
        this.brakeOsc.frequency.setValueAtTime(jitter, time);
      }
    }
  }

  public playStartup() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    
    // Temporarily disable normal throttle mapping
    this.targetRPM = 0;
    this.currentRPM = 0;

    const startTime = ctx.currentTime;

    // 1. Play Starter Motor Click-Crank-Crank
    // Oscillator for starter
    const starterOsc = ctx.createOscillator();
    const starterGain = ctx.createGain();
    starterOsc.type = "square";
    starterOsc.frequency.setValueAtTime(15, startTime);
    starterGain.gain.setValueAtTime(0.0, startTime);
    
    starterOsc.connect(starterGain);
    starterGain.connect(ctx.destination);
    starterOsc.start(startTime);

    // Engine starter cranking bursts
    starterGain.gain.setValueAtTime(0.04, startTime + 0.1);
    starterGain.gain.setValueAtTime(0.0, startTime + 0.2);
    starterGain.gain.setValueAtTime(0.04, startTime + 0.45);
    starterGain.gain.setValueAtTime(0.0, startTime + 0.55);
    starterGain.gain.setValueAtTime(0.04, startTime + 0.8);
    starterGain.gain.setValueAtTime(0.0, startTime + 0.95);
    
    starterOsc.stop(startTime + 1.1);

    // 2. Engine fires up (VROOM!)
    // We simulate this by rapidly rising the RPM, then slowly decaying to idle rumble
    setTimeout(() => {
      if (!this.isStarted) return;
      
      // Rev up
      this.currentRPM = 0.9;
      this.targetRPM = 0.0; // fall back to idle
    }, 1100);
  }

  public playShutdown() {
    if (!this.ctx) return;
    // Shut down engine sound
    this.targetRPM = 0;
    this.currentRPM = 0;
    
    if (this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    if (this.turboGain) {
      this.turboGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    if (this.brakeGain) {
      this.brakeGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public setHorn(active: boolean) {
    if (!this.ctx || !this.hornGain) return;
    const targetVol = active && !this.isMuted ? 0.08 : 0.0;
    this.hornGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.02);
  }

  public setBlinkers(active: boolean) {
    this.isBlinking = active;
    if (active) {
      if (this.blinkerInterval) clearInterval(this.blinkerInterval);
      this.blinkerInterval = setInterval(() => {
        this.playClick(800, 0.04, 0.03); // ticking sound
        setTimeout(() => {
          this.playClick(600, 0.03, 0.03); // release sound
        }, 350);
      }, 700);
    } else {
      if (this.blinkerInterval) {
        clearInterval(this.blinkerInterval);
        this.blinkerInterval = null;
      }
    }
  }

  public playClick(freq = 1000, volume = 0.03, duration = 0.05) {
    if (!this.ctx || this.isMuted) return;
    try {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Click error", e);
    }
  }

  public playGearShift() {
    if (!this.ctx || this.isMuted) return;
    const time = this.ctx.currentTime;
    
    // Quick dip in RPM to simulate shifting gears
    const previousRPM = this.currentRPM;
    this.currentRPM = Math.max(0.1, this.currentRPM - 0.25);
    
    // Metallic shift engage sound (quick high-pass crunch)
    this.playClick(1200, 0.02, 0.08);
  }
}

// Export singleton instance
const instance = new SoundEngine();
export default instance;
