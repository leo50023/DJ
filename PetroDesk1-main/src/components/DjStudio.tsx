import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import {
  Activity,
  AudioLines,
  CircleUserRound,
  Cloud,
  Download,
  FolderOpen,
  Headphones,
  Keyboard,
  Library,
  ListMusic,
  Mic2,
  Mic,
  MicOff,
  MonitorPlay,
  Music2,
  Pause,
  Play,
  Radio,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Star,
  Upload,
  Volume2,
  WandSparkles,
  Youtube,
  X,
} from 'lucide-react';
import {
  DEFAULT_MACROS,
  DEFAULT_SHORTCUTS,
  KeyboardMacros,
  SessionHistory,
  SetPlanner,
  ShowTimeline,
  type MacroAction,
  type MacroMap,
  type SessionSummary,
  type ShortcutAction,
  type ShortcutMap,
  type ShowCue,
  type SmartTrack,
  type TrackMood,
} from './DjExtras';

type Deck = 'A' | 'B';
type StudioMode = 'DECKS' | 'SAMPLER' | 'PAD FX' | 'RECORDER' | 'SET PLANNER' | 'SHOW' | 'SHORTCUTS' | 'HISTORY';
type FxMode = 'Off' | 'Low-pass' | 'High-pass' | 'Flanger' | 'Cut';
type VoiceLanguage = 'en-US' | 'fil-PH';
type LayoutPreset = 'STARTER' | 'ESSENTIALS' | 'PRO' | 'PERFORMANCE';
type DeckPadMode = 'BEATGRID' | 'ROLLS' | 'SCRATCH' | 'SAMPLER';

type Track = SmartTrack & {
  source: 'Local' | 'Generated';
  bpm: number | null;
  color: string;
  file: File;
  url: string;
  favorite: boolean;
};

type Equalizer = { low: number; mid: number; high: number };
type DemoStyle = 'house' | 'lofi' | 'disco' | 'breakbeat';
type DemoPreset = { fileName: string; title: string; bpm: number; rootHz: number; energy: number; mood: TrackMood; style: DemoStyle; seed: number };
type TrackUsage = { plays: number; lastPlayedAt: number };
type TrackTag = { energy: number; mood: TrackMood };
type PerformanceSession = { id: string; startedAt: number; plays: number; trackIds: string[]; recordings: number };
type VoiceResult = { 0: { transcript: string }; length: number };
type VoiceRecognitionEvent = { results: ArrayLike<VoiceResult> };
type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type VoiceRecognitionWindow = Window & {
  SpeechRecognition?: new () => VoiceRecognition;
  webkitSpeechRecognition?: new () => VoiceRecognition;
};

type AudioGraph = {
  context: AudioContext;
  deckGain: Record<Deck, GainNode>;
  eq: Record<Deck, Record<keyof Equalizer, BiquadFilterNode>>;
  fx: Record<Deck, BiquadFilterNode>;
  flangerWet: Record<Deck, GainNode>;
  masterGain: GainNode;
  outputGain: GainNode;
  recordingDestination: MediaStreamAudioDestinationNode;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const STORAGE_KEYS = {
  plan: 'mixwave_set_plan',
  cues: 'mixwave_show_cues',
  showStartedAt: 'mixwave_show_started_at',
  history: 'mixwave_performance_history',
  session: 'mixwave_current_session',
  shortcuts: 'mixwave_shortcuts',
  macros: 'mixwave_macros',
  voiceLanguage: 'mixwave_voice_language',
  trackTags: 'mixwave_track_tags',
  trackUsage: 'mixwave_track_usage',
  favorites: 'mixwave_track_favorites',
};

const STUDIO_MODES: StudioMode[] = ['DECKS', 'SET PLANNER', 'SHOW', 'SAMPLER', 'PAD FX', 'RECORDER', 'SHORTCUTS', 'HISTORY'];
const MOODS: TrackMood[] = ['Warm-up', 'Groove', 'Peak', 'Chill', 'Closing'];
const MACRO_ACTIONS: MacroAction[] = ['play-a', 'play-b', 'kick', 'snare', 'fade-a', 'fade-b', 'low-pass', 'high-pass', 'record'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStored<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    if (isValid(value)) return value;
    console.error(`Ignoring invalid MixWave local data for "${key}".`);
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`Could not read MixWave local data for "${key}":`, error);
  }
  return fallback;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isShowCueArray(value: unknown): value is ShowCue[] {
  return Array.isArray(value) && value.every((item) => isObject(item)
    && typeof item.id === 'string' && typeof item.title === 'string'
    && typeof item.atSeconds === 'number' && typeof item.completed === 'boolean');
}

function isSessionSummaryArray(value: unknown): value is SessionSummary[] {
  return Array.isArray(value) && value.every((item) => isObject(item)
    && typeof item.id === 'string' && typeof item.startedAt === 'number'
    && typeof item.endedAt === 'number' && typeof item.durationSeconds === 'number'
    && typeof item.plays === 'number' && typeof item.uniqueTracks === 'number'
    && typeof item.recordings === 'number');
}

function isPerformanceSession(value: unknown): value is PerformanceSession {
  return isObject(value) && typeof value.id === 'string' && typeof value.startedAt === 'number'
    && typeof value.plays === 'number' && value.plays >= 0 && isStringArray(value.trackIds)
    && typeof value.recordings === 'number' && value.recordings >= 0;
}

function isShortcutMap(value: unknown): value is ShortcutMap {
  if (!isObject(value) || !Object.keys(DEFAULT_SHORTCUTS).every((key) => typeof value[key] === 'string')) return false;
  const keys = Object.values(value);
  return keys.every((key) => typeof key === 'string' && key.length === 1 && !/\s/.test(key))
    && new Set(keys).size === keys.length;
}

function isMacroMap(value: unknown): value is MacroMap {
  return isObject(value) && [1, 2, 3, 4].every((slot) => MACRO_ACTIONS.includes(value[slot] as MacroAction));
}

function isVoiceLanguage(value: unknown): value is VoiceLanguage {
  return value === 'en-US' || value === 'fil-PH';
}

function isTrackTagMap(value: unknown): value is Record<string, TrackTag> {
  return isObject(value) && Object.values(value).every((tag) => isObject(tag)
    && typeof tag.energy === 'number' && tag.energy >= 1 && tag.energy <= 5
    && typeof tag.mood === 'string' && MOODS.includes(tag.mood as TrackMood));
}

function isTrackUsageMap(value: unknown): value is Record<string, TrackUsage> {
  return isObject(value) && Object.values(value).every((usage) => isObject(usage)
    && typeof usage.plays === 'number' && usage.plays >= 0 && typeof usage.lastPlayedAt === 'number');
}

function isStringSet(value: unknown): value is string[] {
  return isStringArray(value);
}

function persistStored(key: string, value: unknown, onError: (message: string) => void) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save MixWave local data for "${key}":`, error);
    onError('Could not save this feature data in browser storage.');
  }
}

function createPerformanceSession(): PerformanceSession {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, startedAt: Date.now(), plays: 0, trackIds: [], recordings: 0 };
}

const sources = [
  { name: 'Library', icon: Library },
  { name: 'YouTube', icon: Youtube },
  { name: 'Spotify', icon: Radio },
  { name: 'SoundCloud', icon: Cloud },
  { name: 'Apple Music', icon: Music2 },
];

const officialSearchUrls: Record<string, (query: string) => string> = {
  YouTube: (query) => `https://www.youtube.com/results?search_query=${query}`,
  Spotify: (query) => `https://open.spotify.com/search/${query}`,
  SoundCloud: (query) => `https://soundcloud.com/search?q=${query}`,
  'Apple Music': (query) => `https://music.apple.com/us/search?term=${query}`,
};

const padNotes = [
  { label: 'KICK', frequency: 65.41, type: 'sine' as OscillatorType },
  { label: 'SNARE', frequency: 196, type: 'triangle' as OscillatorType },
  { label: 'CLOSED HAT', frequency: 880, type: 'square' as OscillatorType },
  { label: 'OPEN HAT', frequency: 587.33, type: 'sawtooth' as OscillatorType },
];

const ORIGINAL_DEMOS: DemoPreset[] = [
  { fileName: 'mixwave-original-deep-house.wav', title: 'Deep House Sunrise', bpm: 122, rootHz: 55, energy: 4, mood: 'Groove', style: 'house', seed: 127 },
  { fileName: 'mixwave-original-lofi-sunset.wav', title: 'Lo-fi Sunset', bpm: 86, rootHz: 65.41, energy: 2, mood: 'Chill', style: 'lofi', seed: 314 },
  { fileName: 'mixwave-original-disco-bounce.wav', title: 'Disco Bounce', bpm: 118, rootHz: 73.42, energy: 4, mood: 'Peak', style: 'disco', seed: 582 },
  { fileName: 'mixwave-original-breakbeat-drive.wav', title: 'Breakbeat Drive', bpm: 132, rootHz: 49, energy: 5, mood: 'Peak', style: 'breakbeat', seed: 941 },
];

function createOriginalDemoFile(preset: DemoPreset) {
  const sampleRate = 22050;
  const beats = 8 * 4;
  const secondsPerBeat = 60 / preset.bpm;
  const duration = beats * secondsPerBeat;
  const sampleCount = Math.ceil(duration * sampleRate);
  const samples = new Float32Array(sampleCount);
  let seed = preset.seed >>> 0;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const addTone = (start: number, length: number, frequency: number, amplitude: number, shape: 'sine' | 'triangle' = 'sine') => {
    const first = Math.max(0, Math.floor(start * sampleRate));
    const last = Math.min(sampleCount, Math.ceil((start + length) * sampleRate));
    for (let index = first; index < last; index++) {
      const time = index / sampleRate - start;
      const phase = 2 * Math.PI * frequency * time;
      const wave = shape === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
      samples[index] += wave * amplitude * Math.exp(-time * 3.8) * Math.min(1, time * 90);
    }
  };
  const addNoise = (start: number, length: number, amplitude: number, decay: number) => {
    const first = Math.max(0, Math.floor(start * sampleRate));
    const last = Math.min(sampleCount, Math.ceil((start + length) * sampleRate));
    for (let index = first; index < last; index++) {
      const time = index / sampleRate - start;
      samples[index] += (random() * 2 - 1) * amplitude * Math.exp(-time * decay);
    }
  };
  const addKick = (start: number) => {
    const length = 0.24;
    const first = Math.floor(start * sampleRate);
    const last = Math.min(sampleCount, Math.ceil((start + length) * sampleRate));
    for (let index = first; index < last; index++) {
      const time = index / sampleRate - start;
      const frequency = 46 + 115 * Math.exp(-time * 20);
      samples[index] += Math.sin(2 * Math.PI * frequency * time) * 0.58 * Math.exp(-time * 14);
    }
  };

  const bassSteps = [0, 0, 7, 0, 5, 5, 7, 3];
  const melodySteps = [12, 7, 10, 14, 12, 7, 3, 10];
  for (let beat = 0; beat < beats; beat++) {
    const position = beat % 4;
    const time = beat * secondsPerBeat;
    const kick = preset.style === 'disco'
      || (preset.style === 'breakbeat' ? position === 0 || position === 3 : position === 0 || position === 2);
    if (kick) addKick(time);
    if (position === 1 || position === 3) {
      addNoise(time, preset.style === 'lofi' ? 0.2 : 0.16, preset.style === 'lofi' ? 0.13 : 0.18, 19);
      addTone(time, 0.12, 180, 0.12);
    }
    if (preset.style !== 'lofi' || beat % 2 === 0) {
      addTone(time, secondsPerBeat * 0.8, preset.rootHz * 2 ** (bassSteps[beat % bassSteps.length] / 12), 0.09);
    }
    if (beat % 8 === 0) {
      [0, 3, 7].forEach((interval) => addTone(time, secondsPerBeat * 3.5, preset.rootHz * 2 ** (interval / 12), 0.025, 'triangle'));
    }
    if (beat % 2 === 0) {
      addTone(time + 0.04, secondsPerBeat * 0.55, preset.rootHz * 4 * 2 ** (melodySteps[(beat / 2) % melodySteps.length] / 12), 0.025, 'triangle');
    }
    const hatCount = preset.style === 'disco' ? 2 : 1;
    for (let subdivision = 0; subdivision < hatCount; subdivision++) {
      addNoise(time + subdivision * secondsPerBeat / hatCount, 0.045, 0.04, 72);
    }
  }

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const dataSize = sampleCount * 2;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataSize, true);
  const scale = peak > 0 ? 0.88 / peak : 1;
  for (let index = 0; index < sampleCount; index++) {
    view.setInt16(44 + index * 2, Math.max(-32768, Math.min(32767, Math.round(samples[index] * scale * 32767))), true);
  }
  return new File([wav], preset.fileName, { type: 'audio/wav', lastModified: 1 });
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function getLoopStart(audio: HTMLAudioElement | null, loopLength: number) {
  if (!audio || loopLength <= 0 || !Number.isFinite(audio.duration)) return audio?.currentTime ?? 0;
  return Math.min(audio.currentTime, Math.max(0, audio.duration - loopLength));
}

function makeDeckGraph(context: AudioContext, audio: HTMLAudioElement, masterGain: GainNode) {
  const source = context.createMediaElementSource(audio);
  const low = context.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 250;
  const mid = context.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1000;
  mid.Q.value = 0.8;
  const high = context.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 5000;
  const fx = context.createBiquadFilter();
  fx.type = 'allpass';
  const gain = context.createGain();
  const flangerDelay = context.createDelay(0.05);
  const flangerWet = context.createGain();
  const flangerLfo = context.createOscillator();
  const flangerDepth = context.createGain();
  flangerDelay.delayTime.value = 0.006;
  flangerWet.gain.value = 0;
  flangerLfo.frequency.value = 0.25;
  flangerDepth.gain.value = 0.004;
  flangerLfo.connect(flangerDepth);
  flangerDepth.connect(flangerDelay.delayTime);
  flangerLfo.start();
  source.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(fx);
  fx.connect(gain);
  fx.connect(flangerDelay);
  flangerDelay.connect(flangerWet);
  flangerWet.connect(gain);
  gain.connect(masterGain);

  return { gain, eq: { low, mid, high }, fx, flangerWet };
}

function Waveform({
  active = false,
  progress = 0,
  deck = 'A',
  compact = false,
  layout = 'STARTER',
}: {
  active?: boolean;
  progress?: number;
  deck?: Deck;
  compact?: boolean;
  layout?: LayoutPreset;
}) {
  const baseBars = [24, 44, 32, 58, 68, 38, 52, 76, 64, 46, 82, 56, 34, 72, 48, 62, 88, 54, 40, 70, 84, 50, 36, 66, 78, 42, 60, 30, 74, 52];
  const bars = layout === 'PRO'
    ? Array.from({ length: 60 }, (_, index) => Math.min(96, baseBars[index % baseBars.length] * (index % 2 ? 0.82 : 1)))
    : layout === 'PERFORMANCE'
      ? baseBars.map((height, index) => Math.min(96, height + (index % 3) * 8))
      : layout === 'ESSENTIALS'
        ? baseBars.map((height, index) => Math.max(12, height - (index % 4) * 5))
        : baseBars;
  const accent = deck === 'A' ? 'bg-cyan-400' : 'bg-fuchsia-400';
  const position = Math.max(0, Math.min(1, progress));
  const playedAccent = layout === 'ESSENTIALS'
    ? deck === 'A' ? 'bg-emerald-400' : 'bg-violet-400'
    : layout === 'PRO'
      ? 'bg-gradient-to-t from-cyan-500 via-blue-400 to-fuchsia-300'
      : layout === 'PERFORMANCE'
        ? deck === 'A' ? 'bg-cyan-300' : 'bg-fuchsia-300'
        : accent;
  return (
    <div className={`relative flex ${compact ? 'h-8' : 'h-16'} items-center ${layout === 'PRO' ? 'gap-px' : layout === 'PERFORMANCE' ? 'gap-[2px]' : 'gap-[3px]'} overflow-hidden rounded-sm border border-white/5 bg-black/30 px-2`}>
      {bars.map((height, index) => (
        <div
          key={index}
          className={`min-w-[2px] flex-1 ${layout === 'PERFORMANCE' ? 'rounded-none' : 'rounded-full'} ${index / bars.length <= position && active ? playedAccent : 'bg-slate-500/70'}`}
          style={{ height: `${height}%`, opacity: layout === 'PERFORMANCE' ? 0.55 + (index % 4) * 0.12 : 0.45 + (index % 5) * 0.12 }}
        />
      ))}
      {layout === 'PERFORMANCE' && Array.from({ length: 9 }, (_, index) => (
        <span key={`beat-${index}`} aria-hidden="true" className="absolute top-0 h-full w-px bg-white/10" style={{ left: `${(index + 1) * 10}%` }} />
      ))}
      {active && <div className="absolute top-0 h-full w-px bg-white/90 shadow-[0_0_8px_white]" style={{ left: `${position * 100}%` }} />}
    </div>
  );
}

function DeckPanel({
  deck,
  track,
  audioRef,
  playing,
  currentTime,
  duration,
  progress,
  layout,
  tempo,
  loopLength,
  looping,
  onToggle,
  onFile,
  onCue,
  onSync,
  onMixAssist,
  onLoop,
  onTempoChange,
  onLoopLengthChange,
  onSeek,
  onSkip,
  onDownload,
  onPlayingChange,
  onTrackStart,
  onTimeUpdate,
  onDuration,
  onError,
  onPad,
  onPattern,
}: {
  deck: Deck;
  track: Track | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  playing: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  layout: LayoutPreset;
  tempo: number;
  loopLength: number;
  looping: boolean;
  onToggle: () => void;
  onFile: (file: File) => void;
  onCue: () => void;
  onSync: () => void;
  onMixAssist: () => void;
  onLoop: () => void;
  onTempoChange: (value: number) => void;
  onLoopLengthChange: (value: number) => void;
  onSeek: (time: number) => void;
  onSkip: (direction: -1 | 1) => void;
  onDownload: () => void;
  onPlayingChange: (value: boolean) => void;
  onTrackStart: () => void;
  onTimeUpdate: (value: number) => void;
  onDuration: (value: number) => void;
  onError: () => void;
  onPad: (index: number) => void;
  onPattern: (slot: 1 | 2 | 3 | 4) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [padMode, setPadMode] = useState<DeckPadMode>('SAMPLER');
  const accent = deck === 'A' ? 'text-cyan-400' : 'text-fuchsia-400';
  const border = deck === 'A' ? 'border-cyan-400/30' : 'border-fuchsia-400/30';
  const buttonColor = deck === 'A' ? 'bg-cyan-400' : 'bg-fuchsia-400';

  return (
    <section className={`min-w-0 rounded-xl border ${border} bg-gradient-to-br from-[#1b2028] to-[#14161b] p-2 shadow-lg`}>
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/5 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-white/5 text-sm font-black ${accent}`}>{deck}</span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-white">{track?.title || 'Drag a song onto this deck'}</p>
            <p className="truncate text-[9px] text-slate-500">{track?.artist || 'or load a local audio file'}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-right font-mono text-[8px] text-slate-500 sm:block">BPM {track?.bpm ? (track.bpm * tempo / 100).toFixed(1) : '--'}<br />{formatTime(Math.max(0, duration - currentTime))} REM</span>
          {track && (
            <button type="button" onClick={onDownload} title="Download this imported local file" aria-label={`Download ${track.title}`} className="rounded-md p-2 text-slate-400 hover:bg-white/5 hover:text-white">
              <Download className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-sm border border-white/10 px-2 py-1.5 text-[9px] font-bold text-slate-300 hover:bg-white/5">
            <FolderOpen className="mr-1 inline h-3 w-3" /> LOAD
          </button>
        </div>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = '';
        }} />
      </div>

      <div className="relative mb-2">
        <Waveform active={Boolean(track)} progress={progress} deck={deck} layout={layout} />
      </div>
      <input
        aria-label={`Seek deck ${deck}`}
        type="range"
        min="0"
        max={Math.max(duration, 0)}
        step="0.1"
        value={Math.min(currentTime, duration || 0)}
        onChange={(event) => onSeek(Number(event.target.value))}
        disabled={!track || duration <= 0}
        className={`mb-1 w-full ${deck === 'A' ? 'accent-cyan-400' : 'accent-fuchsia-400'}`}
      />
      <div className="mb-2 flex justify-between font-mono text-[9px] text-slate-500">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <label className="mb-2 flex items-center gap-2 text-[7px] font-bold tracking-wider text-slate-600">
        <span className="w-16 shrink-0">TEMPO {tempo}%</span>
        <input aria-label={`Tempo deck ${deck}`} type="range" min="70" max="130" value={tempo} onChange={(event) => onTempoChange(Number(event.target.value))} className={`w-full ${deck === 'A' ? 'accent-cyan-400' : 'accent-fuchsia-400'}`} />
      </label>

      <div className="grid grid-cols-[minmax(90px,0.8fr)_minmax(130px,1.2fr)] gap-2">
        <div className="relative grid aspect-square max-h-32 place-items-center justify-self-center rounded-full border-[8px] border-[#090b0e] bg-[radial-gradient(circle,_#42464d_0%,_#25282d_54%,_#101216_55%)] shadow-[0_0_18px_#000]">
          <div className={`grid h-[72%] w-[72%] place-items-center rounded-full border border-white/15 ${deck === 'A' ? 'bg-[repeating-radial-gradient(circle,#125364_0px,#125364_2px,#0d3744_3px,#0d3744_4px)]' : 'bg-[repeating-radial-gradient(circle,#5a245e_0px,#5a245e_2px,#37173c_3px,#37173c_4px)]'} opacity-90`}>
            <span className={`grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/50 text-[7px] font-black ${accent}`}>MIX</span>
          </div>
          <div className="absolute h-2.5 w-2.5 rounded-full border border-white/40 bg-[#17191e]" />
        </div>
        <div>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={onCue} title="Set cue while paused; return to cue while playing" className="h-7 border border-white/10 bg-white/[0.03] text-[8px] font-bold text-slate-400 hover:text-white">CUE</button>
            <button type="button" onClick={onSync} title="Align this deck to the other deck's play position" className="h-7 border border-white/10 bg-white/[0.03] text-[8px] font-bold text-slate-400 hover:text-white">SYNC</button>
            <button type="button" onClick={onLoop} aria-pressed={looping} className={`h-7 border text-[8px] font-bold ${looping ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'}`}>{looping ? 'LOOP ON' : 'LOOP'}</button>
            <button type="button" onClick={onMixAssist} title="Sync this deck and fade the crossfader to it" className="h-7 border border-white/10 bg-white/[0.03] text-[8px] font-bold text-slate-400 hover:text-white">MIX ASSIST</button>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <button type="button" onClick={() => onSkip(-1)} aria-label={`Seek backward on deck ${deck}`} className="text-slate-500 hover:text-white"><SkipBack className="h-4 w-4" /></button>
            <button type="button" onClick={onToggle} aria-label={`${playing ? 'Pause' : 'Play'} deck ${deck}`} className={`grid h-8 w-8 place-items-center rounded-full ${buttonColor} text-black`}>
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button type="button" onClick={() => onSkip(1)} aria-label={`Seek forward on deck ${deck}`} className="text-slate-500 hover:text-white"><SkipForward className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <div className="mt-2 border-t border-white/5 pt-2">
        <div className="mb-1 flex items-center justify-between text-[7px] font-bold tracking-widest text-slate-600"><span>PADS</span><span>DECK {deck} CONTROLS</span></div>
        <div className="mb-1 grid grid-cols-4 gap-1">
          {(['BEATGRID', 'ROLLS', 'SCRATCH', 'SAMPLER'] as DeckPadMode[]).map((mode) => (
            <button key={mode} type="button" onClick={() => setPadMode(mode)} aria-pressed={padMode === mode} className={`border py-1.5 text-[7px] font-bold tracking-wide ${padMode === mode ? `${border} ${accent}` : 'border-white/5 text-slate-600 hover:text-slate-300'}`}>{mode}</button>
          ))}
        </div>
        {padMode === 'BEATGRID' && (
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={onCue} className="border border-white/5 py-1.5 text-[7px] font-bold text-slate-300">SET / RETURN CUE</button>
            <button type="button" onClick={onSync} className="border border-white/5 py-1.5 text-[7px] font-bold text-slate-300">SYNC DECKS</button>
          </div>
        )}
        {padMode === 'ROLLS' && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-1">
            <select aria-label={`Loop length for deck ${deck}`} value={loopLength} onChange={(event) => onLoopLengthChange(Number(event.target.value))} className="min-w-0 border border-white/5 bg-[#0b0d10] px-1 text-[7px] text-slate-300">
              <option value="0">Full track</option>
              <option value="0.5">0.5 sec</option>
              <option value="1">1 sec</option>
              <option value="2">2 sec</option>
              <option value="4">4 sec</option>
            </select>
            <button type="button" onClick={onLoop} aria-pressed={looping} className={`border px-2 text-[7px] font-bold ${looping ? 'border-cyan-400/40 text-cyan-300' : 'border-white/5 text-slate-300'}`}>{looping ? 'STOP ROLL' : 'ROLL'}</button>
            <button type="button" onClick={() => onSkip(1)} className="border border-white/5 py-1.5 text-[7px] font-bold text-slate-300">NUDGE +</button>
          </div>
        )}
        {padMode === 'SCRATCH' && (
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => onSkip(-1)} className="border border-white/5 py-1.5 text-[7px] font-bold text-slate-300">NUDGE BACK</button>
            <button type="button" onClick={() => onSkip(1)} className="border border-white/5 py-1.5 text-[7px] font-bold text-slate-300">NUDGE FORWARD</button>
          </div>
        )}
        {padMode === 'SAMPLER' && (
          <div className="grid grid-cols-4 gap-1">
            {padNotes.map((pad, index) => (
              <button key={pad.label} type="button" onClick={() => onPad(index)} className={`border border-white/5 py-1.5 text-[7px] font-bold ${index % 2 ? 'text-fuchsia-300 hover:bg-fuchsia-400/10' : 'text-cyan-300 hover:bg-cyan-400/10'}`}>{pad.label}</button>
            ))}
          </div>
        )}
        <div className="mt-1 grid grid-cols-4 gap-1">
          {([1, 2, 3, 4] as const).map((slot) => (
            <button key={slot} type="button" onClick={() => onPattern(slot)} title={`Run performance macro ${slot}`} className="border border-white/5 py-1.5 text-[7px] font-bold text-slate-500 hover:text-cyan-300">PATTERN {slot}</button>
          ))}
        </div>
      </div>
      <audio
        ref={audioRef}
        className="hidden"
        onPlay={() => {
          onPlayingChange(true);
          onTrackStart();
        }}
        onPause={() => onPlayingChange(false)}
        onEnded={() => onPlayingChange(false)}
        onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)}
        onError={onError}
      />
    </section>
  );
}

export default function DjStudio() {
  const [activeSource, setActiveSource] = useState('Library');
  const [activePlaylist, setActivePlaylist] = useState('All tracks');
  const [activeMode, setActiveMode] = useState<StudioMode>('DECKS');
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('STARTER');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackA, setTrackA] = useState<Track | null>(null);
  const [trackB, setTrackB] = useState<Track | null>(null);
  const [playingA, setPlayingA] = useState(false);
  const [playingB, setPlayingB] = useState(false);
  const [durationA, setDurationA] = useState(0);
  const [durationB, setDurationB] = useState(0);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const [loopA, setLoopA] = useState(false);
  const [loopB, setLoopB] = useState(false);
  const [loopLengthA, setLoopLengthA] = useState(0);
  const [loopLengthB, setLoopLengthB] = useState(0);
  const [tempoA, setTempoA] = useState(100);
  const [tempoB, setTempoB] = useState(100);
  const [crossfade, setCrossfade] = useState(50);
  const [master, setMaster] = useState(82);
  const [volumeA, setVolumeA] = useState(80);
  const [volumeB, setVolumeB] = useState(80);
  const [eqA, setEqA] = useState<Equalizer>({ low: 0, mid: 0, high: 0 });
  const [eqB, setEqB] = useState<Equalizer>({ low: 0, mid: 0, high: 0 });
  const [fxMode, setFxMode] = useState<FxMode>('Off');
  const [defaultDeck, setDefaultDeck] = useState<Deck>('A');
  const [autoPlayLoaded, setAutoPlayLoaded] = useState(true);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [monitorMuted, setMonitorMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [videoError, setVideoError] = useState('');
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [notice, setNotice] = useState('');
  const [generatingDemos, setGeneratingDemos] = useState(false);
  const [planIds, setPlanIds] = useState<string[]>(() => readStored(STORAGE_KEYS.plan, [], isStringArray));
  const [showCues, setShowCues] = useState<ShowCue[]>(() => readStored(STORAGE_KEYS.cues, [], isShowCueArray));
  const [showStartedAt, setShowStartedAt] = useState<number | null>(() =>
    readStored(STORAGE_KEYS.showStartedAt, null, (value): value is number | null => value === null || typeof value === 'number'));
  const [showElapsed, setShowElapsed] = useState(0);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [sessionHistory, setSessionHistory] = useState<SessionSummary[]>(() => readStored(STORAGE_KEYS.history, [], isSessionSummaryArray));
  const [performanceSession, setPerformanceSession] = useState<PerformanceSession>(() =>
    readStored(STORAGE_KEYS.session, createPerformanceSession(), isPerformanceSession));
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => readStored(STORAGE_KEYS.shortcuts, DEFAULT_SHORTCUTS, isShortcutMap));
  const [macros, setMacros] = useState<MacroMap>(() => readStored(STORAGE_KEYS.macros, DEFAULT_MACROS, isMacroMap));
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>(() => readStored(STORAGE_KEYS.voiceLanguage, 'en-US', isVoiceLanguage));
  const [shortcutError, setShortcutError] = useState('');
  const [trackTags, setTrackTags] = useState<Record<string, TrackTag>>(() => readStored(STORAGE_KEYS.trackTags, {}, isTrackTagMap));
  const [trackUsage, setTrackUsage] = useState<Record<string, TrackUsage>>(() => readStored(STORAGE_KEYS.trackUsage, {}, isTrackUsageMap));
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStored(STORAGE_KEYS.favorites, [], isStringSet));
  const [voiceListening, setVoiceListening] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingName, setRecordingName] = useState('');
  const audioA = useRef<HTMLAudioElement>(null);
  const audioB = useRef<HTMLAudioElement>(null);
  const audioGraph = useRef<AudioGraph | null>(null);
  const graphCleanupTimer = useRef<number | null>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const videoPicker = useRef<HTMLInputElement>(null);
  const cuePoints = useRef<Record<Deck, number>>({ A: 0, B: 0 });
  const loopStarts = useRef<Record<Deck, number>>({ A: 0, B: 0 });
  const loadedTrackOnDeck = useRef<Record<Deck, string | null>>({ A: null, B: null });
  const recorder = useRef<MediaRecorder | null>(null);
  const objectUrls = useRef<string[]>([]);
  const recorderUrl = useRef('');
  const countedTrackOnDeck = useRef<Record<Deck, string | null>>({ A: null, B: null });
  const voiceRecognition = useRef<VoiceRecognition | null>(null);

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleInstall);
  }, []);

  useEffect(() => {
    const elementA = audioA.current;
    const elementB = audioB.current;
    if (!elementA || !elementB) return;

    if (graphCleanupTimer.current !== null) {
      window.clearTimeout(graphCleanupTimer.current);
      graphCleanupTimer.current = null;
    }

    const disposeGraph = () => {
      const graph = audioGraph.current;
      if (!graph) return;
      graphCleanupTimer.current = window.setTimeout(() => {
        if (audioGraph.current === graph) {
          audioGraph.current = null;
          void graph.context.close();
        }
        graphCleanupTimer.current = null;
      }, 0);
    };

    if (audioGraph.current) return disposeGraph;

    try {
      const context = new AudioContext();
      const masterGain = context.createGain();
      const outputGain = context.createGain();
      const recordingDestination = context.createMediaStreamDestination();
      const deckAGraph = makeDeckGraph(context, elementA, masterGain);
      const deckBGraph = makeDeckGraph(context, elementB, masterGain);
      masterGain.connect(outputGain);
      outputGain.connect(context.destination);
      masterGain.connect(recordingDestination);
      audioGraph.current = {
        context,
        deckGain: { A: deckAGraph.gain, B: deckBGraph.gain },
        eq: { A: deckAGraph.eq, B: deckBGraph.eq },
        fx: { A: deckAGraph.fx, B: deckBGraph.fx },
        flangerWet: { A: deckAGraph.flangerWet, B: deckBGraph.flangerWet },
        masterGain,
        outputGain,
        recordingDestination,
      };
    } catch (error) {
      console.error('Could not initialize the audio mixer:', error);
      setNotice('The browser could not initialize audio mixing. Try reloading or use a supported browser.');
      return;
    }

    return disposeGraph;
  }, []);

  useEffect(() => {
    const graph = audioGraph.current;
    if (!graph) return;
    const fade = (crossfade / 100) * (Math.PI / 2);
    graph.deckGain.A.gain.setTargetAtTime((volumeA / 100) * Math.cos(fade), graph.context.currentTime, 0.02);
    graph.deckGain.B.gain.setTargetAtTime((volumeB / 100) * Math.sin(fade), graph.context.currentTime, 0.02);
    graph.masterGain.gain.setTargetAtTime(master / 100, graph.context.currentTime, 0.02);
    graph.outputGain.gain.setTargetAtTime(monitorMuted ? 0 : 1, graph.context.currentTime, 0.02);
  }, [crossfade, master, monitorMuted, volumeA, volumeB]);

  useEffect(() => {
    if (audioA.current) audioA.current.playbackRate = tempoA / 100;
    if (audioB.current) audioB.current.playbackRate = tempoB / 100;
  }, [tempoA, tempoB]);

  useEffect(() => {
    const graph = audioGraph.current;
    if (!graph) return;
    (['A', 'B'] as Deck[]).forEach((deck) => {
      const values = deck === 'A' ? eqA : eqB;
      graph.eq[deck].low.gain.setTargetAtTime(values.low, graph.context.currentTime, 0.02);
      graph.eq[deck].mid.gain.setTargetAtTime(values.mid, graph.context.currentTime, 0.02);
      graph.eq[deck].high.gain.setTargetAtTime(values.high, graph.context.currentTime, 0.02);
      graph.fx[deck].type = fxMode === 'Low-pass' || fxMode === 'Cut' ? 'lowpass' : fxMode === 'High-pass' ? 'highpass' : 'allpass';
      const cutoff = fxMode === 'Low-pass' ? 1200 : fxMode === 'Cut' ? 180 : 650;
      graph.fx[deck].frequency.setTargetAtTime(cutoff, graph.context.currentTime, 0.02);
      graph.flangerWet[deck].gain.setTargetAtTime(fxMode === 'Flanger' ? 0.55 : 0, graph.context.currentTime, 0.02);
    });
  }, [eqA, eqB, fxMode]);

  useEffect(() => persistStored(STORAGE_KEYS.plan, planIds, setNotice), [planIds]);
  useEffect(() => persistStored(STORAGE_KEYS.cues, showCues, setNotice), [showCues]);
  useEffect(() => persistStored(STORAGE_KEYS.showStartedAt, showStartedAt, setNotice), [showStartedAt]);
  useEffect(() => persistStored(STORAGE_KEYS.history, sessionHistory, setNotice), [sessionHistory]);
  useEffect(() => persistStored(STORAGE_KEYS.session, performanceSession, setNotice), [performanceSession]);
  useEffect(() => persistStored(STORAGE_KEYS.shortcuts, shortcuts, setNotice), [shortcuts]);
  useEffect(() => persistStored(STORAGE_KEYS.macros, macros, setNotice), [macros]);
  useEffect(() => persistStored(STORAGE_KEYS.voiceLanguage, voiceLanguage, setNotice), [voiceLanguage]);
  useEffect(() => persistStored(STORAGE_KEYS.trackTags, trackTags, setNotice), [trackTags]);
  useEffect(() => persistStored(STORAGE_KEYS.trackUsage, trackUsage, setNotice), [trackUsage]);
  useEffect(() => persistStored(STORAGE_KEYS.favorites, favoriteIds, setNotice), [favoriteIds]);

  useEffect(() => {
    const updateClock = () => {
      const currentTime = Date.now();
      setClockNow(currentTime);
      setShowElapsed(showStartedAt ? Math.max(0, Math.floor((currentTime - showStartedAt) / 1000)) : 0);
    };
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [showStartedAt]);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    voiceRecognition.current?.stop();
  }, []);

  useEffect(() => {
    if (!videoUrl) return;
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const addFile = (
    file: File,
    deck?: Deck,
    autoplay = autoPlayLoaded,
    loadIntoDeck = true,
    source: Track['source'] = 'Local',
    demo?: DemoPreset,
  ) => {
    const allowed = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i.test(file.name);
    if (!allowed) {
      setNotice('Please choose a supported local audio file.');
      return;
    }

    const id = `${file.name.toLowerCase()}-${file.size}-${file.lastModified}`;
    const existing = tracks.find((track) => track.id === id);
    if (existing) {
      if (loadIntoDeck) loadTrack(deck || defaultDeck, existing, autoplay);
      setNotice(`${existing.title} is already in your local library.`);
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const tag = trackTags[id] || { energy: 3, mood: 'Groove' as TrackMood };
    const usage = trackUsage[id] || { plays: 0, lastPlayedAt: 0 };
    const track: Track = {
      id,
      title: demo ? `MixWave Original - ${demo.title}` : file.name.replace(/\.[^/.]+$/, ''),
      artist: source === 'Generated' ? 'MixWave Originals' : 'Local file',
      duration: demo ? formatTime(8 * 4 * 60 / demo.bpm) : '00:00',
      source,
      bpm: demo?.bpm ?? null,
      color: 'from-cyan-400 to-blue-700',
      file,
      url,
      addedAt: Date.now(),
      energy: demo?.energy ?? tag.energy,
      mood: demo?.mood ?? tag.mood,
      playCount: usage.plays,
      favorite: favoriteIds.includes(id),
    };
    setTracks((current) => [...current, track]);
    if (demo) {
      setTrackTags((current) => ({ ...current, [id]: { energy: demo.energy, mood: demo.mood } }));
    }
    setActiveSource('Library');
    setNotice(`${track.title} added to your local library.`);
    if (loadIntoDeck) {
      setActivePlaylist('All tracks');
      const target = deck || defaultDeck;
      loadTrack(target, track, autoplay);
    }
  };

  const addOriginalDemoPack = () => {
    setGeneratingDemos(true);
    try {
      const existingIds = new Set(tracks.map((track) => track.id));
      let added = 0;
      ORIGINAL_DEMOS.forEach((demo) => {
        const file = createOriginalDemoFile(demo);
        const id = `${file.name.toLowerCase()}-${file.size}-${file.lastModified}`;
        if (existingIds.has(id)) return;
        addFile(file, undefined, false, false, 'Generated', demo);
        existingIds.add(id);
        added++;
      });
      setActiveSource('Library');
      setActivePlaylist('Original demos');
      setNotice(added ? `Added ${added} original demo tracks to your library.` : 'The original demo pack is already in your library.');
    } catch (error) {
      console.error('Could not generate the original demo pack:', error);
      setNotice('Could not generate demo tracks in this browser.');
    } finally {
      setGeneratingDemos(false);
    }
  };

  const loadTrack = (deck: Deck, track: Track, autoplay: boolean) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    if (!audio) return;
    setSelectedTrackId(track.id);
    audio.pause();
    audio.src = track.url;
    const loopEnabled = deck === 'A' ? loopA : loopB;
    const loopLength = deck === 'A' ? loopLengthA : loopLengthB;
    audio.loop = loopEnabled && loopLength === 0;
    loopStarts.current[deck] = 0;
    audio.currentTime = 0;
    audio.load();
    loadedTrackOnDeck.current[deck] = track.id;
    countedTrackOnDeck.current[deck] = null;
    if (deck === 'A') {
      setTrackA(track);
      setCurrentTimeA(0);
      setDurationA(0);
    } else {
      setTrackB(track);
      setCurrentTimeB(0);
      setDurationB(0);
    }
    if (autoplay) {
      const graph = audioGraph.current;
      if (graph?.context.state === 'suspended') void graph.context.resume();
      void audio.play().catch(() => setNotice('Playback was blocked. Press the deck play button to start.'));
    }
  };

  const toggleDeck = async (deck: Deck) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    if (!audio?.src) {
      setNotice(`Load a local audio file on deck ${deck} first.`);
      return;
    }
    try {
      if (audio.paused) {
        const graph = audioGraph.current;
        if (graph?.context.state === 'suspended') await graph.context.resume();
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.error(`Deck ${deck} playback failed:`, error);
      setNotice('Playback could not start. Check that the selected file format is supported.');
    }
  };

  const seek = (deck: Deck, time: number) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(time, audio.duration));
  };

  const skip = (deck: Deck, direction: -1 | 1) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    if (audio) seek(deck, audio.currentTime + direction * 10);
  };

  const updateDeckTime = (deck: Deck, time: number) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    const looping = deck === 'A' ? loopA : loopB;
    const loopLength = deck === 'A' ? loopLengthA : loopLengthB;
    const loopStart = loopStarts.current[deck];
    if (looping && loopLength > 0 && audio && Number.isFinite(audio.duration)) {
      const loopEnd = Math.min(loopStart + loopLength, audio.duration);
      if (loopEnd > loopStart && time >= loopEnd) {
        audio.currentTime = loopStart;
        if (deck === 'A') setCurrentTimeA(loopStart); else setCurrentTimeB(loopStart);
        return;
      }
    }
    if (deck === 'A') setCurrentTimeA(time); else setCurrentTimeB(time);
  };

  const setCue = (deck: Deck) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    if (!audio?.src) {
      setNotice(`Load a track on deck ${deck} before setting a cue.`);
      return;
    }
    if (!audio.paused) {
      audio.pause();
      audio.currentTime = cuePoints.current[deck];
    } else {
      cuePoints.current[deck] = audio.currentTime;
      setNotice(`Cue point saved for deck ${deck}.`);
    }
  };

  const syncDeck = (deck: Deck) => {
    const target = deck === 'A' ? audioA.current : audioB.current;
    const reference = deck === 'A' ? audioB.current : audioA.current;
    if (!target?.src || !reference?.src) {
      setNotice('Load a track on both decks to sync their play positions.');
      return;
    }
    if (deck === 'A') setTempoA(reference.playbackRate * 100); else setTempoB(reference.playbackRate * 100);
    target.playbackRate = reference.playbackRate;
    target.currentTime = Math.min(reference.currentTime, Math.max(0, target.duration || reference.currentTime));
    const graph = audioGraph.current;
    if (graph?.context.state === 'suspended') void graph.context.resume();
    void target.play().catch(() => setNotice('Could not start the synced deck.'));
  };

  const mixAssist = (deck: Deck) => {
    const target = deck === 'A' ? audioA.current : audioB.current;
    const reference = deck === 'A' ? audioB.current : audioA.current;
    if (!target?.src || !reference?.src) {
      setNotice('Load tracks on both decks before using Mix Assist.');
      return;
    }
    syncDeck(deck);
    setCrossfade(deck === 'A' ? 0 : 100);
    setNotice(`Deck ${deck} synced and faded in.`);
  };

  const toggleLoop = (deck: Deck) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    const next = !(deck === 'A' ? loopA : loopB);
    const loopLength = deck === 'A' ? loopLengthA : loopLengthB;
    if (audio) {
      const loopStart = getLoopStart(audio, loopLength);
      loopStarts.current[deck] = loopStart;
      const loopEnd = Math.min(loopStart + loopLength, audio.duration);
      if (next && loopLength > 0 && audio.currentTime >= loopEnd) audio.currentTime = loopStart;
      audio.loop = next && loopLength === 0;
    }
    if (deck === 'A') setLoopA(next); else setLoopB(next);
  };

  const setLoopLength = (deck: Deck, length: number) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    const looping = deck === 'A' ? loopA : loopB;
    if (audio) {
      const loopStart = getLoopStart(audio, length);
      loopStarts.current[deck] = loopStart;
      const loopEnd = Math.min(loopStart + length, audio.duration);
      if (looping && length > 0 && audio.currentTime >= loopEnd) audio.currentTime = loopStart;
      audio.loop = looping && length === 0;
    }
    if (deck === 'A') setLoopLengthA(length); else setLoopLengthB(length);
  };

  const recordTrackStart = (deck: Deck) => {
    const trackId = loadedTrackOnDeck.current[deck];
    if (!trackId || countedTrackOnDeck.current[deck] === trackId) return;
    countedTrackOnDeck.current[deck] = trackId;
    const playedAt = Date.now();
    setTracks((current) => current.map((item) => item.id === trackId ? { ...item, playCount: item.playCount + 1 } : item));
    setTrackUsage((current) => ({
      ...current,
      [trackId]: { plays: (current[trackId]?.plays || 0) + 1, lastPlayedAt: playedAt },
    }));
    setPerformanceSession((current) => ({
      ...current,
      plays: current.plays + 1,
      trackIds: current.trackIds.includes(trackId) ? current.trackIds : [...current.trackIds, trackId],
    }));
  };

  const updateTrackTags = (id: string, update: { energy?: number; mood?: TrackMood }) => {
    setTracks((current) => current.map((track) => track.id === id ? { ...track, ...update } : track));
    setTrackTags((current) => {
      const currentTag = current[id] || { energy: 3, mood: 'Groove' as TrackMood };
      return { ...current, [id]: { ...currentTag, ...update } };
    });
  };

  const updateTrackDuration = (deck: Deck, duration: number) => {
    const id = loadedTrackOnDeck.current[deck];
    if (!id) return;
    const formatted = formatTime(duration);
    setTracks((current) => current.map((track) => track.id === id ? { ...track, duration: formatted } : track));
  };

  const downloadTrack = (track: Track) => {
    const anchor = document.createElement('a');
    anchor.href = track.url;
    anchor.download = track.file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadAllTracks = () => {
    const localTracks = tracks.filter((track) => track.source === 'Local');
    if (!localTracks.length) return;
    localTracks.forEach(downloadTrack);
    setNotice(`Started downloads for ${localTracks.length} imported tracks. Allow multiple downloads if your browser asks.`);
  };

  const downloadRecording = () => {
    if (!recordingUrl) return;
    const anchor = document.createElement('a');
    anchor.href = recordingUrl;
    anchor.download = recordingName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const openOfficialSearch = () => {
    const urlBuilder = officialSearchUrls[activeSource];
    if (!urlBuilder) return;
    const url = urlBuilder(encodeURIComponent(query || 'DJ music'));
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) setNotice('The browser blocked the new tab. Allow pop-ups to open the official music service.');
  };

  const triggerPad = async (frequency: number, type: OscillatorType) => {
    const graph = audioGraph.current;
    if (!graph) {
      setNotice('Audio is not ready yet. Try again in a moment.');
      return;
    }
    try {
      if (graph.context.state === 'suspended') await graph.context.resume();
      const oscillator = graph.context.createOscillator();
      const gain = graph.context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, graph.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, graph.context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, graph.context.currentTime + (type === 'sine' ? 0.32 : 0.12));
      oscillator.connect(gain);
      gain.connect(graph.masterGain);
      oscillator.start();
      oscillator.stop(graph.context.currentTime + 0.35);
    } catch (error) {
      console.error('Sampler pad failed:', error);
      setNotice('Could not play the sampler sound in this browser.');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recorder.current?.stop();
      setIsRecording(false);
      return;
    }
    const graph = audioGraph.current;
    if (!graph || typeof MediaRecorder === 'undefined') {
      setNotice('Recording is not supported by this browser.');
      return;
    }
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const nextRecorder = new MediaRecorder(graph.recordingDestination.stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      nextRecorder.onerror = (event) => {
        console.error('Mix recording failed:', event);
        setNotice('Recording failed. Check browser permissions and available storage.');
        setIsRecording(false);
      };
      nextRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: nextRecorder.mimeType || 'audio/webm' });
        if (recorderUrl.current) URL.revokeObjectURL(recorderUrl.current);
        recorderUrl.current = URL.createObjectURL(blob);
        objectUrls.current.push(recorderUrl.current);
        setRecordingUrl(recorderUrl.current);
        setRecordingName(`mixwave-set-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`);
        setPerformanceSession((current) => ({ ...current, recordings: current.recordings + 1 }));
        setNotice('Recording is ready to download.');
      };
      recorder.current = nextRecorder;
      nextRecorder.start();
      setIsRecording(true);
      setNotice('Recording the master mix. Press STOP when finished.');
    } catch (error) {
      console.error('Could not start mix recording:', error);
      setNotice('Could not start recording in this browser.');
    }
  };

  const runMacro = (slot: 1 | 2 | 3 | 4) => {
    switch (macros[slot]) {
      case 'play-a': void toggleDeck('A'); break;
      case 'play-b': void toggleDeck('B'); break;
      case 'kick': void triggerPad(padNotes[0].frequency, padNotes[0].type); break;
      case 'snare': void triggerPad(padNotes[1].frequency, padNotes[1].type); break;
      case 'fade-a': setCrossfade(0); break;
      case 'fade-b': setCrossfade(100); break;
      case 'low-pass': setFxMode('Low-pass'); break;
      case 'high-pass': setFxMode('High-pass'); break;
      case 'record': toggleRecording(); break;
    }
  };

  const runShortcut = (action: ShortcutAction) => {
    switch (action) {
      case 'playA': void toggleDeck('A'); break;
      case 'playB': void toggleDeck('B'); break;
      case 'cueA': setCue('A'); break;
      case 'cueB': setCue('B'); break;
      case 'loopA': toggleLoop('A'); break;
      case 'loopB': toggleLoop('B'); break;
      case 'record': toggleRecording(); break;
      case 'macro1': runMacro(1); break;
      case 'macro2': runMacro(2); break;
      case 'macro3': runMacro(3); break;
      case 'macro4': runMacro(4); break;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey
        || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      const pressed = event.key.toLowerCase();
      const action = (Object.entries(shortcuts) as [ShortcutAction, string][]).find(([, key]) => key.toLowerCase() === pressed)?.[0];
      if (!action) return;
      event.preventDefault();
      runShortcut(action);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, macros, isRecording, playingA, playingB, trackA, trackB, loopA, loopB]);

  const updateShortcut = (action: ShortcutAction, key: string) => {
    const normalized = key.toLowerCase();
    if (!normalized || normalized.length !== 1 || /\s/.test(normalized)) return;
    const conflict = (Object.entries(shortcuts) as [ShortcutAction, string][]).find(([otherAction, otherKey]) => otherAction !== action && otherKey.toLowerCase() === normalized);
    if (conflict) {
      setShortcutError(`${normalized.toUpperCase()} is already assigned. Choose a different key.`);
      return;
    }
    setShortcutError('');
    setShortcuts((current) => ({ ...current, [action]: normalized }));
  };

  const playNextTrack = (deck: Deck) => {
    const currentTrack = deck === 'A' ? trackA : trackB;
    const orderedTracks = planIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track));
    const queue = orderedTracks.length ? orderedTracks : [...tracks].sort((a, b) => a.title.localeCompare(b.title));
    if (!queue.length) {
      setNotice('Import tracks or build a set plan before using next track.');
      return;
    }
    const currentIndex = queue.findIndex((track) => track.id === currentTrack?.id);
    const next = queue[(currentIndex + 1) % queue.length];
    loadTrack(deck, next, true);
    setNotice(`Loaded ${next.title} on deck ${deck}.`);
  };

  const handleVoiceCommand = (transcript: string) => {
    const command = transcript.trim().toLowerCase();
    setLastVoiceCommand(command);
    const deck: Deck = /\b(deck b|plato b|b)\b/.test(command) ? 'B' : 'A';

    if (/\b(record|recording|rekord)\b/.test(command)) {
      if (/\b(stop|finish|end|ihinto|tigil)\b/.test(command) && isRecording) toggleRecording();
      else if (/\b(start|begin|simulan)\b/.test(command) && !isRecording) toggleRecording();
      else setNotice(`Recording is ${isRecording ? 'active' : 'stopped'}. Say "start recording" or "stop recording".`);
    } else if (/\b(next|skip|sunod|susunod|laktaw)\b/.test(command) && /\b(track|song|kanta)\b/.test(command)) {
      playNextTrack(deck);
    } else if (/\b(pause|stop|ihinto|tigil)\b/.test(command) && /\b(all|both|lahat|pareho)\b/.test(command)) {
      audioA.current?.pause();
      audioB.current?.pause();
      setNotice('Paused both decks.');
    } else if (/\b(pause|stop|ihinto|tigil|pahinga)\b/.test(command)) {
      (deck === 'A' ? audioA.current : audioB.current)?.pause();
      setNotice(`Paused deck ${deck}.`);
    } else if (/\b(play|start|patugtugin|tugtog|simulan|andar)\b/.test(command) && /\b(deck|plato|track|music|song|kanta|musika|a|b)\b/.test(command)) {
      const audio = deck === 'A' ? audioA.current : audioB.current;
      if (audio?.paused) void toggleDeck(deck);
      else if (!audio?.src) setNotice(`Load a track on deck ${deck} first.`);
    } else if (/\b(cue|mark|marka)\b/.test(command)) {
      setCue(deck);
    } else if (/\b(loop|ulitin|paulit)\b/.test(command)) {
      toggleLoop(deck);
      setNotice(`Loop ${deck === 'A' ? (loopA ? 'disabled' : 'enabled') : (loopB ? 'disabled' : 'enabled')} on deck ${deck}.`);
    } else if (/\b(planner|set plan|setlist|plano)\b/.test(command)) {
      setActiveMode('SET PLANNER');
    } else if (/\b(show|timeline|palabas|event)\b/.test(command)) {
      setActiveMode('SHOW');
    } else {
      setNotice(`Didn't recognize "${command}". Try "play deck A", "pause deck B", "next track", or Filipino "patugtugin A".`);
    }
  };

  const toggleVoiceControl = () => {
    if (voiceRecognition.current) {
      voiceRecognition.current.stop();
      voiceRecognition.current = null;
      setVoiceListening(false);
      setNotice('Voice control stopped.');
      return;
    }
    const SpeechRecognition = (window as VoiceRecognitionWindow).SpeechRecognition
      || (window as VoiceRecognitionWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice('Voice control is not supported in this browser. Try a current Chromium-based browser.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceLanguage;
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        if (result?.[0]?.transcript) handleVoiceCommand(result[0].transcript);
      };
      recognition.onerror = (event) => {
        console.error('Voice recognition failed:', event.error);
        voiceRecognition.current = null;
        setNotice(`Voice control error: ${event.error}. Check microphone permission and try again.`);
        setVoiceListening(false);
      };
      recognition.onend = () => {
        if (voiceRecognition.current === recognition) {
          voiceRecognition.current = null;
          setVoiceListening(false);
          setNotice('Voice control stopped.');
        }
      };
      recognition.start();
      voiceRecognition.current = recognition;
      setVoiceListening(true);
      setNotice('Listening for voice commands. Speech is handled by your browser.');
    } catch (error) {
      console.error('Could not start voice recognition:', error);
      setNotice('Could not start voice control. Check microphone permission.');
    }
  };

  const addShowCue = (title: string, atSeconds: number) => {
    setShowCues((current) => [...current, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      atSeconds,
      completed: false,
    }]);
  };

  const finishPerformanceSession = () => {
    const endedAt = Date.now();
    setSessionHistory((current) => [...current, {
      id: performanceSession.id,
      startedAt: performanceSession.startedAt,
      endedAt,
      durationSeconds: Math.max(0, Math.floor((endedAt - performanceSession.startedAt) / 1000)),
      plays: performanceSession.plays,
      uniqueTracks: performanceSession.trackIds.length,
      recordings: performanceSession.recordings,
    }]);
    setPerformanceSession(createPerformanceSession());
    setNotice('Performance session saved locally.');
  };

  const updateMacro = (slot: 1 | 2 | 3 | 4, action: MacroAction) => {
    setMacros((current) => ({ ...current, [slot]: action }));
  };

  const installApp = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (error) {
      console.error('PWA installation prompt failed:', error);
      setNotice('The app could not be installed from this browser.');
    }
  };

  const filteredTracks = tracks
    .filter((track) => track.title.toLowerCase().includes(query.toLowerCase()) || track.artist.toLowerCase().includes(query.toLowerCase()))
    .filter((track) => {
      if (onlyFavorites || activePlaylist === 'Favorites') return track.favorite;
      if (activePlaylist === 'Original demos') return track.source === 'Generated';
      if (activePlaylist === 'Most played') return track.playCount > 0;
      if (activePlaylist === 'Peak energy') return track.energy >= 4;
      if (activePlaylist === 'Chill & downtempo') return track.mood === 'Chill' || track.energy <= 2;
      return true;
    })
    .sort((left, right) => {
      if (activePlaylist === 'Recently added') return right.addedAt - left.addedAt;
      if (activePlaylist === 'Most played') return right.playCount - left.playCount || left.title.localeCompare(right.title);
      if (activePlaylist === 'Peak energy') return right.energy - left.energy || left.title.localeCompare(right.title);
      if (activePlaylist === 'Chill & downtempo') return left.energy - right.energy || left.title.localeCompare(right.title);
      return left.title.localeCompare(right.title);
    });
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId)
    || trackA
    || trackB
    || filteredTracks[0]
    || null;

  const toggleFavorite = (id: string) => {
    const wasFavorite = favoriteIds.includes(id);
    setFavoriteIds((current) => wasFavorite ? current.filter((trackId) => trackId !== id) : [...current, id]);
    setTracks((current) => current.map((track) => track.id === id ? { ...track, favorite: !wasFavorite } : track));
  };

  const handleTrackFile = (event: ChangeEvent<HTMLInputElement>) => {
    Array.from(event.target.files || []).forEach((file) => addFile(file));
    event.currentTarget.value = '';
  };

  const handleVideoFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|ogv|mkv|avi)$/i.test(file.name)) {
      setVideoError('');
      setShowVideoPreview(false);
      setNotice('Choose a supported local video file.');
      return;
    }
    setVideoError('');
    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
    setShowVideoPreview(true);
  };

  const openVideoPreview = () => {
    if (videoUrl) setShowVideoPreview(true);
    else videoPicker.current?.click();
  };

  const modes = STUDIO_MODES;
  const playlists = ['All tracks', 'Original demos', 'Recently added', 'Favorites', 'Most played', 'Peak energy', 'Chill & downtempo'];
  const workspaceColumns = layoutPreset === 'ESSENTIALS'
    ? 'md:grid-cols-[128px_minmax(0,1fr)] xl:grid-cols-[156px_minmax(0,1fr)_212px]'
    : layoutPreset === 'PRO'
      ? 'md:grid-cols-[144px_minmax(0,1fr)] xl:grid-cols-[196px_minmax(0,1fr)_290px]'
      : layoutPreset === 'PERFORMANCE'
        ? 'md:grid-cols-[112px_minmax(0,1fr)] xl:grid-cols-[128px_minmax(0,1fr)_190px]'
        : 'md:grid-cols-[136px_minmax(0,1fr)] xl:grid-cols-[176px_minmax(0,1fr)_244px]';
  const deckColumns = 'sm:grid-cols-2';

  return (
    <div className="h-[100dvh] min-h-0 overflow-y-auto bg-[#0b0d10] text-slate-200">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b border-white/5 bg-[#111318]/95 px-3 shadow-sm backdrop-blur sm:px-4">
        <div className="flex w-auto items-center gap-2 md:w-44">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black">
            <AudioLines className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight text-white">MIXWAVE</p>
            <p className="text-[9px] font-bold tracking-[0.2em] text-cyan-400">PRO DJ</p>
          </div>
        </div>
        <label className="mr-3 hidden items-center gap-2 border-l border-white/10 pl-3 text-[8px] font-bold tracking-wider text-slate-500 md:flex">
          LAYOUT
          <select aria-label="Layout preset" value={layoutPreset} onChange={(event) => setLayoutPreset(event.target.value as LayoutPreset)} className="rounded-sm border border-white/10 bg-[#0b0d10] px-2 py-1.5 text-[9px] text-slate-300">
            <option value="STARTER">STARTER</option>
            <option value="ESSENTIALS">ESSENTIALS</option>
            <option value="PRO">PRO</option>
            <option value="PERFORMANCE">PERFORMANCE</option>
          </select>
        </label>
        <nav className="hidden h-full items-center gap-2 lg:flex">
          {modes.map((mode) => (
            <button key={mode} type="button" onClick={() => setActiveMode(mode)} className={`flex h-full shrink-0 items-center gap-1 border-b-2 px-1 text-[9px] font-bold tracking-wider ${activeMode === mode ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>
              {mode === 'SET PLANNER' && <WandSparkles className="h-3 w-3" />}
              {mode === 'SHORTCUTS' && <Keyboard className="h-3 w-3" />}
              {mode}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          {installPrompt && <button type="button" onClick={installApp} className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-1.5 text-[8px] font-bold text-cyan-400 sm:text-[9px]">INSTALL</button>}
          <span className="hidden items-center gap-1 rounded-sm border border-cyan-400/20 bg-cyan-400/5 px-2 py-1 text-[8px] font-bold text-cyan-300 sm:flex">AUDIO</span>
          <button type="button" onClick={openVideoPreview} title={videoUrl ? `Preview ${videoName}` : 'Open a local video preview'} aria-label="Open local video preview" className="rounded-sm border border-white/10 px-2 py-1 text-[8px] font-bold text-slate-400 hover:border-cyan-400/30 hover:text-cyan-300">VIDEO</button>
          <input ref={videoPicker} type="file" accept="video/*,.mkv,.avi" className="hidden" onChange={handleVideoFile} />
          <button type="button" onClick={toggleVoiceControl} title={voiceListening ? 'Stop voice control' : 'Start voice control'} aria-label={voiceListening ? 'Stop voice control' : 'Start voice control'} className={`rounded-md p-2 hover:bg-white/5 ${voiceListening ? 'text-rose-300' : 'text-slate-400'}`}>
            {voiceListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <span className="hidden items-center gap-1.5 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-400 sm:flex">
            <Activity className="h-3 w-3" /> LOCAL AUDIO
          </span>
          <button type="button" onClick={() => setMonitorMuted((value) => !value)} title={monitorMuted ? 'Unmute master monitor' : 'Mute master monitor'} aria-label={monitorMuted ? 'Unmute master monitor' : 'Mute master monitor'} className={`rounded-md p-2 hover:bg-white/5 ${monitorMuted ? 'text-rose-400' : 'text-slate-400'}`}>
            <MonitorPlay className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings" className="rounded-md p-2 text-slate-400 hover:bg-white/5"><Settings className="h-4 w-4" /></button>
          <div className="relative">
            <button type="button" onClick={() => setShowProfile((value) => !value)} title="Local session" aria-label="Open local session menu" className="ml-1 rounded-full bg-slate-700 p-1.5"><CircleUserRound className="h-4 w-4" /></button>
            {showProfile && (
              <div className="absolute right-0 top-10 z-40 w-56 rounded-lg border border-white/10 bg-[#1b1e24] p-3 shadow-xl">
                <p className="text-xs font-bold text-white">Local DJ session</p>
                <p className="mt-1 text-[10px] text-slate-400">{tracks.length} imported local tracks</p>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Streaming services open on their official sites. MixWave does not download streaming tracks.</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <section aria-label="Deck waveform overview" className="grid grid-cols-1 gap-1 border-b border-white/5 bg-[#090b0d] px-3 py-1 sm:grid-cols-2 sm:px-4">
        {([
          { deck: 'A' as Deck, track: trackA, playing: playingA, time: currentTimeA, duration: durationA },
          { deck: 'B' as Deck, track: trackB, playing: playingB, time: currentTimeB, duration: durationB },
        ]).map(({ deck, track, playing, time, duration }) => (
          <div key={deck} className="flex min-w-0 items-center gap-2">
            <span className={`w-3 text-[8px] font-black ${deck === 'A' ? 'text-cyan-300' : 'text-fuchsia-300'}`}>{deck}</span>
            <span className="hidden w-28 truncate text-[8px] text-slate-500 lg:block">{track?.title || 'No track loaded'}</span>
            <div className="min-w-0 flex-1"><Waveform active={Boolean(track)} progress={duration ? time / duration : 0} deck={deck} compact layout={layoutPreset} /></div>
          </div>
        ))}
      </section>

      <div className={`grid min-h-[calc(100%-96px)] grid-cols-1 ${workspaceColumns}`}>
        <aside className="hidden border-r border-white/5 bg-[#111318] p-2 md:block">
          <p className="mb-2 px-2 text-[9px] font-bold tracking-[0.18em] text-slate-600">LOCAL MUSIC</p>
          <div className="space-y-1">
            {sources.map((source) => {
              const Icon = source.icon;
              return (
                <button key={source.name} type="button" title={source.name} onClick={() => { setActiveSource(source.name); setOnlyFavorites(false); }} className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs ${activeSource === source.name ? 'bg-cyan-400/10 text-cyan-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                  <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate whitespace-nowrap">{source.name}</span>
                  {source.name !== 'Library' && <span className="ml-auto text-[8px] text-slate-600">OPEN</span>}
                </button>
              );
            })}
          </div>
          <p className="mb-2 mt-5 px-2 text-[9px] font-bold tracking-[0.18em] text-slate-600">MY LISTS</p>
          {playlists.map((name) => (
            <button key={name} type="button" title={name} onClick={() => { setActivePlaylist(name); setActiveSource('Library'); setOnlyFavorites(false); }} className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${activePlaylist === name ? 'text-cyan-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <ListMusic className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate whitespace-nowrap">{name}</span>
            </button>
          ))}
        </aside>

        <main className="min-w-0 overflow-y-auto p-2">
          <nav aria-label="Studio view modes" className="scrollbar-none mb-2 flex gap-1 overflow-x-auto sm:hidden">
            {modes.map((mode) => <button key={mode} type="button" onClick={() => setActiveMode(mode)} className={`shrink-0 rounded-md px-2 py-1.5 text-[9px] font-bold ${activeMode === mode ? 'bg-cyan-400/15 text-cyan-300' : 'bg-white/5 text-slate-400'}`}>{mode}</button>)}
            <button type="button" onClick={openVideoPreview} className="shrink-0 rounded-md bg-white/5 px-2 py-1.5 text-[9px] font-bold text-slate-400">VIDEO</button>
          </nav>
          <div className={`mb-2 grid grid-cols-1 gap-2 ${deckColumns}`}>
            <DeckPanel
              deck="A" track={trackA} audioRef={audioA} playing={playingA} currentTime={currentTimeA} duration={durationA} progress={durationA ? currentTimeA / durationA : 0} layout={layoutPreset} tempo={tempoA} loopLength={loopLengthA} looping={loopA}
              onToggle={() => void toggleDeck('A')} onFile={(file) => addFile(file, 'A')} onCue={() => setCue('A')} onSync={() => syncDeck('A')} onMixAssist={() => mixAssist('A')}
              onLoop={() => toggleLoop('A')} onTempoChange={setTempoA} onLoopLengthChange={(value) => setLoopLength('A', value)} onSeek={(time) => seek('A', time)} onSkip={(direction) => skip('A', direction)}
              onPad={(index) => void triggerPad(padNotes[index].frequency, padNotes[index].type)}
              onPattern={(slot) => runMacro(slot)}
              onDownload={() => trackA && downloadTrack(trackA)} onPlayingChange={setPlayingA} onTimeUpdate={(time) => updateDeckTime('A', time)}
              onTrackStart={() => recordTrackStart('A')}
              onDuration={(value) => {
                setDurationA(value);
                updateTrackDuration('A', value);
              }}
              onError={() => setNotice('This audio file could not be decoded by the browser.')}
            />
            <DeckPanel
              deck="B" track={trackB} audioRef={audioB} playing={playingB} currentTime={currentTimeB} duration={durationB} progress={durationB ? currentTimeB / durationB : 0} layout={layoutPreset} tempo={tempoB} loopLength={loopLengthB} looping={loopB}
              onToggle={() => void toggleDeck('B')} onFile={(file) => addFile(file, 'B')} onCue={() => setCue('B')} onSync={() => syncDeck('B')} onMixAssist={() => mixAssist('B')}
              onLoop={() => toggleLoop('B')} onTempoChange={setTempoB} onLoopLengthChange={(value) => setLoopLength('B', value)} onSeek={(time) => seek('B', time)} onSkip={(direction) => skip('B', direction)}
              onPad={(index) => void triggerPad(padNotes[index].frequency, padNotes[index].type)}
              onPattern={(slot) => runMacro(slot)}
              onDownload={() => trackB && downloadTrack(trackB)} onPlayingChange={setPlayingB} onTimeUpdate={(time) => updateDeckTime('B', time)}
              onTrackStart={() => recordTrackStart('B')}
              onDuration={(value) => {
                setDurationB(value);
                updateTrackDuration('B', value);
              }}
              onError={() => setNotice('This audio file could not be decoded by the browser.')}
            />
          </div>

          <section className="mb-2 rounded-xl border border-white/5 bg-[#15181d] p-2 xl:hidden">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-wider text-slate-400">MOBILE MIXER</p>
              <button type="button" onClick={() => setMonitorMuted((value) => !value)} className={`rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold ${monitorMuted ? 'text-rose-300' : 'text-slate-400'}`}>
                {monitorMuted ? 'UNMUTE' : 'MUTE'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['A', 'B'] as Deck[]).map((deck) => {
                const volume = deck === 'A' ? volumeA : volumeB;
                const setVolume = deck === 'A' ? setVolumeA : setVolumeB;
                const values = deck === 'A' ? eqA : eqB;
                const setValues = deck === 'A' ? setEqA : setEqB;
                const color = deck === 'A' ? 'accent-cyan-400' : 'accent-fuchsia-400';
                return (
                  <div key={deck} className="rounded-lg border border-white/5 bg-black/10 p-2">
                    <div className={`mb-2 text-[9px] font-black ${deck === 'A' ? 'text-cyan-400' : 'text-fuchsia-400'}`}>DECK {deck} · VOL {volume}%</div>
                    <input aria-label={`Mobile deck ${deck} volume`} type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className={`mb-2 w-full ${color}`} />
                    <div className="grid grid-cols-3 gap-1">
                      {(['low', 'mid', 'high'] as (keyof Equalizer)[]).map((band) => (
                        <label key={band} className="text-center text-[7px] text-slate-600">
                          {band.toUpperCase()}
                          <input aria-label={`Mobile deck ${deck} ${band} EQ`} type="range" min="-12" max="12" value={values[band]} onChange={(event) => setValues((current) => ({ ...current, [band]: Number(event.target.value) }))} className={`mt-1 w-full ${color}`} />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <label className="mt-3 block text-[9px] font-bold text-slate-500">
              CROSSFADE · {crossfade < 50 ? 'A' : crossfade > 50 ? 'B' : 'CENTER'}
              <input aria-label="Mobile crossfader" type="range" min="0" max="100" value={crossfade} onChange={(event) => setCrossfade(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
            </label>
            <label className="mt-2 block text-[9px] font-bold text-slate-500">
              MASTER · {master}%
              <input aria-label="Mobile master volume" type="range" min="0" max="100" value={master} onChange={(event) => setMaster(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
            </label>
          </section>

          {notice && (
            <div role="status" className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[11px] text-cyan-100">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message" className="shrink-0 text-cyan-300"><X className="h-4 w-4" /></button>
            </div>
          )}

          {lastVoiceCommand && (
            <p className="mb-3 text-[9px] text-slate-600" aria-live="polite">
              Voice command: “{lastVoiceCommand}” {voiceListening && '· listening'}
            </p>
          )}

          {activeMode === 'DECKS' && (
            <section className="rounded-xl border border-white/5 bg-[#15181d] p-2.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-white">{activeSource === 'Library' ? activePlaylist : activeSource}</p>
                  <p className="text-[10px] text-slate-500">{activeSource === 'Library' ? `${filteredTracks.length} local tracks` : 'Official service search'}</p>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <select aria-label="Select music source" value={activeSource} onChange={(event) => setActiveSource(event.target.value)} className="max-w-32 rounded-md border border-white/5 bg-[#111318] px-2 py-2 text-[10px] text-slate-300 md:hidden">
                    {sources.map((source) => <option key={source.name} value={source.name}>{source.name}</option>)}
                  </select>
                  {activeSource === 'Library' && (
                    <select aria-label="Select playlist" value={activePlaylist} onChange={(event) => { setActivePlaylist(event.target.value); setOnlyFavorites(false); }} className="max-w-32 rounded-md border border-white/5 bg-[#111318] px-2 py-2 text-[10px] text-slate-300 md:hidden">
                      {playlists.map((playlist) => <option key={playlist} value={playlist}>{playlist}</option>)}
                    </select>
                  )}
                  <div className="flex h-8 w-full max-w-xs items-center rounded-md border border-white/5 bg-black/20 px-2">
                    <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeSource === 'Library' ? 'Search local tracks' : `Search ${activeSource}`} className="w-full bg-transparent px-2 text-xs outline-none placeholder:text-slate-600" />
                  </div>
                  {activeSource === 'Library' ? (
                    <>
                      <button type="button" onClick={addOriginalDemoPack} disabled={generatingDemos} title="Generate four original demo music tracks" aria-label="Generate original demo music" className="grid h-8 shrink-0 place-items-center gap-1 border border-cyan-400/20 px-2 text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50 sm:flex sm:grid-cols-none">
                        <WandSparkles className="h-3.5 w-3.5" /><span className="hidden text-[8px] font-bold xl:inline">{generatingDemos ? 'MAKING' : 'DEMO MUSIC'}</span>
                      </button>
                      <button type="button" onClick={() => filePicker.current?.click()} title="Import local audio files" aria-label="Import local audio files" className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/5 text-slate-400 hover:text-cyan-300"><Upload className="h-3.5 w-3.5" /></button>
                      <input ref={filePicker} type="file" accept="audio/*" multiple className="hidden" onChange={handleTrackFile} />
                      <button type="button" onClick={() => setOnlyFavorites((value) => !value)} title="Toggle favorites filter" aria-pressed={onlyFavorites} className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${onlyFavorites ? 'border-amber-400/40 text-amber-300' : 'border-white/5 text-slate-400'}`}><SlidersHorizontal className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={downloadAllTracks} disabled={!tracks.some((track) => track.source === 'Local')} title={`Download all ${tracks.filter((track) => track.source === 'Local').length} imported tracks`} aria-label="Download all imported local music" className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/5 text-slate-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-3.5 w-3.5" /></button>
                    </>
                  ) : (
                    <button type="button" onClick={openOfficialSearch} className="h-8 shrink-0 rounded-md border border-cyan-400/20 px-2 text-[9px] font-bold text-cyan-400 hover:bg-cyan-400/10">OPEN OFFICIAL</button>
                  )}
                </div>
              </div>

              {activeSource === 'Library' ? (
                filteredTracks.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead className="border-b border-white/10 text-[8px] font-bold tracking-wider text-slate-600">
                        <tr><th className="px-2 py-2">TITLE</th><th className="px-2 py-2">ARTIST</th><th className="px-2 py-2">LENGTH</th><th className="px-2 py-2">BPM</th><th className="px-2 py-2">ENERGY</th><th className="px-2 py-2">MOOD</th><th className="px-2 py-2">PLAYS</th><th className="px-2 py-2 text-right">LOAD</th></tr>
                      </thead>
                      <tbody>
                        {filteredTracks.map((track) => (
                          <tr key={track.id} className={`border-b border-white/5 text-[10px] hover:bg-white/[0.03] ${selectedTrackId === track.id ? 'bg-cyan-400/[0.06]' : ''}`}>
                            <td className="max-w-56 px-2 py-1.5">
                              <button type="button" onClick={() => setSelectedTrackId(track.id)} className="flex max-w-full items-center gap-2 text-left">
                                <span className="grid h-6 w-6 shrink-0 place-items-center bg-gradient-to-br from-cyan-500/60 to-violet-700/60"><AudioLines className="h-3.5 w-3.5 text-white/80" /></span>
                                <span className="truncate font-semibold text-slate-200">{track.title}</span>
                                {track.favorite && <Star className="h-3 w-3 shrink-0 fill-amber-300 text-amber-300" />}
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-slate-500">{track.artist}</td>
                            <td className="px-2 py-1.5 font-mono text-slate-400">{track.duration}</td>
                            <td className="px-2 py-1.5 font-mono text-slate-400">{track.bpm ?? '--'}</td>
                            <td className="px-2 py-1.5">
                              <select aria-label={`Energy for ${track.title}`} value={track.energy} onChange={(event) => updateTrackTags(track.id, { energy: Number(event.target.value) })} className="rounded-sm bg-[#0b0d10] p-1 text-[9px] text-slate-200">
                                {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level}/5</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <select aria-label={`Mood for ${track.title}`} value={track.mood} onChange={(event) => updateTrackTags(track.id, { mood: event.target.value as TrackMood })} className="max-w-24 rounded-sm bg-[#0b0d10] p-1 text-[9px] text-slate-200">
                                {MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5 text-slate-500">{track.playCount}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => toggleFavorite(track.id)} title={track.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-label={track.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={track.favorite} className={`px-1 ${track.favorite ? 'text-amber-300' : 'text-slate-600 hover:text-amber-300'}`}><Star className={`h-3 w-3 ${track.favorite ? 'fill-current' : ''}`} /></button>
                                <button type="button" onClick={() => loadTrack('A', track, autoPlayLoaded)} title="Load on deck A" className="bg-cyan-400/10 px-2 py-1 text-[8px] font-bold text-cyan-300">A</button>
                                <button type="button" onClick={() => loadTrack('B', track, autoPlayLoaded)} title="Load on deck B" className="bg-fuchsia-400/10 px-2 py-1 text-[8px] font-bold text-fuchsia-300">B</button>
                                <button type="button" onClick={() => downloadTrack(track)} title="Download local file" aria-label={`Download ${track.title}`} className="px-1 text-slate-500 hover:text-white"><Download className="h-3 w-3" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center">
                    <FolderOpen className="mx-auto h-6 w-6 text-slate-600" />
                    <p className="mt-2 text-xs font-semibold text-slate-300">{tracks.length ? 'No tracks match this view' : 'Your local library is empty'}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Import audio files you own or are authorized to use.</p>
                    <button type="button" onClick={() => filePicker.current?.click()} className="mt-3 rounded-md bg-cyan-400 px-3 py-2 text-[10px] font-bold text-black">IMPORT AUDIO</button>
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 px-4 py-7 text-center">
                  <p className="text-xs font-semibold text-slate-300">Connect through {activeSource}</p>
                  <p className="mx-auto mt-1 max-w-md text-[10px] leading-relaxed text-slate-500">Search opens the official service. Streaming playback, downloads, and account linking are controlled by that provider; MixWave does not bypass its access or download restrictions.</p>
                  <button type="button" onClick={openOfficialSearch} className="mt-3 rounded-md border border-cyan-400/30 px-3 py-2 text-[10px] font-bold text-cyan-300 hover:bg-cyan-400/10">SEARCH {activeSource.toUpperCase()}</button>
                </div>
              )}
            </section>
          )}

          {activeMode === 'SAMPLER' && (
            <section className="rounded-xl border border-white/5 bg-[#15181d] p-3">
              <h2 className="text-xs font-bold text-white">SAMPLER PADS</h2>
              <p className="mb-3 mt-1 text-[10px] text-slate-500">Tap a pad to play a synthesized one-shot sound.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {padNotes.map((pad, index) => <button key={pad.label} type="button" onClick={() => void triggerPad(pad.frequency, pad.type)} className={`aspect-square max-h-28 max-w-28 justify-self-center rounded-xl border text-xs font-black tracking-wider active:scale-95 ${index % 2 ? 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200 hover:bg-fuchsia-400/20' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20'}`}>{pad.label}<span className="mt-2 block text-[9px] font-normal text-slate-500">PAD {index + 1}</span></button>)}
              </div>
            </section>
          )}

          {activeMode === 'PAD FX' && (
            <section className="rounded-xl border border-white/5 bg-[#15181d] p-3">
              <h2 className="text-xs font-bold text-white">AUDIO EFFECTS</h2>
              <p className="mb-3 mt-1 text-[10px] text-slate-500">Effects process the audio loaded on both local decks.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {(['Off', 'Low-pass', 'High-pass', 'Flanger', 'Cut'] as FxMode[]).map((effect) => <button key={effect} type="button" onClick={() => setFxMode(effect)} aria-pressed={fxMode === effect} className={`rounded-lg border px-3 py-3 text-xs font-bold ${fxMode === effect ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-black/10 text-slate-400 hover:text-white'}`}>{effect}<span className="mt-1 block text-[9px] font-normal text-slate-500">{effect === 'Off' ? 'Bypass effects' : effect === 'Low-pass' ? 'Cut high frequencies' : effect === 'High-pass' ? 'Cut low frequencies' : effect === 'Flanger' ? 'Modulated delay effect' : 'Low-pass cut'}</span></button>)}
              </div>
            </section>
          )}

          {activeMode === 'RECORDER' && (
            <section className="rounded-xl border border-white/5 bg-[#15181d] p-3">
              <h2 className="text-xs font-bold text-white">MASTER RECORDER</h2>
              <p className="mb-3 mt-1 text-[10px] text-slate-500">Record the local deck mix and sampler output to an audio file.</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={toggleRecording} className={`rounded-md px-4 py-2 text-xs font-bold ${isRecording ? 'bg-rose-500 text-white' : 'bg-cyan-400 text-black'}`}>{isRecording ? 'STOP RECORDING' : 'START RECORDING'}</button>
                <span className={`text-[10px] font-bold ${isRecording ? 'text-rose-400' : 'text-slate-500'}`}>{isRecording ? '● RECORDING' : '● STOPPED'}</span>
                {recordingUrl && <button type="button" onClick={downloadRecording} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"><Download className="h-4 w-4" /> DOWNLOAD MIX</button>}
              </div>
              {!trackA && !trackB && <p className="mt-4 text-[10px] text-amber-300/80">Load a local track or use the sampler to create audio for your recording.</p>}
            </section>
          )}

          {activeMode === 'SET PLANNER' && (
            <SetPlanner
              tracks={tracks}
              planIds={planIds}
              onPlanChange={setPlanIds}
              onLoadTrack={(deck, plannedTrack) => {
                const track = tracks.find((item) => item.id === plannedTrack.id);
                if (track) loadTrack(deck, track, autoPlayLoaded);
              }}
              onTagChange={updateTrackTags}
            />
          )}

          {activeMode === 'SHOW' && (
            <ShowTimeline
              cues={showCues}
              elapsed={showElapsed}
              startedAt={showStartedAt}
              onStart={() => {
                const started = Date.now();
                setShowStartedAt(started);
                setShowCues((current) => current.map((cue) => ({ ...cue, completed: false })));
              }}
              onReset={() => {
                setShowStartedAt(null);
                setShowCues((current) => current.map((cue) => ({ ...cue, completed: false })));
              }}
              onAddCue={addShowCue}
              onCompleteCue={(id) => setShowCues((current) => current.map((cue) => cue.id === id ? { ...cue, completed: true } : cue))}
              onRemoveCue={(id) => setShowCues((current) => current.filter((cue) => cue.id !== id))}
            />
          )}

          {activeMode === 'SHORTCUTS' && (
            <KeyboardMacros
              shortcuts={shortcuts}
              macros={macros}
              shortcutError={shortcutError}
              onShortcutChange={updateShortcut}
              onMacroChange={updateMacro}
              onReset={() => {
                setShortcuts(DEFAULT_SHORTCUTS);
                setMacros(DEFAULT_MACROS);
                setShortcutError('');
              }}
            />
          )}

          {activeMode === 'HISTORY' && (
            <SessionHistory
              current={performanceSession}
              history={sessionHistory}
              onFinish={finishPerformanceSession}
              now={clockNow}
            />
          )}
        </main>

        <aside className="hidden border-l border-white/5 bg-[#111318] p-2 xl:block">
          <section className="mb-3 border-b border-white/5 pb-2">
            <p className="mb-2 text-[9px] font-bold tracking-wider text-slate-500">TRACK DETAILS</p>
            {selectedTrack ? (
              <>
                <div className="mb-2 grid aspect-[2/1] place-items-center border border-white/5 bg-gradient-to-br from-cyan-500/20 via-[#16191f] to-fuchsia-500/20">
                  <AudioLines className="h-8 w-8 text-cyan-300/70" />
                </div>
                <p className="break-words text-[11px] font-bold leading-relaxed text-white">{selectedTrack.title}</p>
                <p className="mt-1 text-[9px] text-slate-500">{selectedTrack.artist} · {selectedTrack.source}</p>
                <dl className="mt-3 space-y-1.5 text-[9px]">
                  <div className="flex justify-between gap-2"><dt className="text-slate-600">Length</dt><dd className="font-mono text-slate-300">{selectedTrack.duration}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-slate-600">BPM</dt><dd className="font-mono text-slate-300">{selectedTrack.bpm ?? '--'}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-slate-600">Energy</dt><dd className="text-cyan-300">{selectedTrack.energy}/5 · {selectedTrack.mood}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-slate-600">Play count</dt><dd className="text-slate-300">{selectedTrack.playCount}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-slate-600">Last played</dt><dd className="text-slate-300">{trackUsage[selectedTrack.id]?.lastPlayedAt ? new Date(trackUsage[selectedTrack.id].lastPlayedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</dd></div>
                </dl>
                <div className="mt-3 grid grid-cols-2 gap-1">
                  <button type="button" onClick={() => loadTrack('A', selectedTrack, autoPlayLoaded)} className="bg-cyan-400/10 py-1.5 text-[8px] font-bold text-cyan-300">LOAD DECK A</button>
                  <button type="button" onClick={() => loadTrack('B', selectedTrack, autoPlayLoaded)} className="bg-fuchsia-400/10 py-1.5 text-[8px] font-bold text-fuchsia-300">LOAD DECK B</button>
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-[9px] text-slate-600">Select a local track to view its details.</p>
            )}
          </section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wider text-slate-400">MASTER MIXER</p>
            <Headphones className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="grid grid-cols-[1fr_44px_1fr] gap-2">
            {(['A', 'B'] as Deck[]).map((deck) => {
              const values = deck === 'A' ? eqA : eqB;
              const setValues = deck === 'A' ? setEqA : setEqB;
              const volume = deck === 'A' ? volumeA : volumeB;
              const setVolume = deck === 'A' ? setVolumeA : setVolumeB;
              const tint = deck === 'A' ? 'accent-cyan-400' : 'accent-fuchsia-400';
              return (
                <div key={deck} className="text-center">
                  <div className={`text-[9px] font-black ${deck === 'A' ? 'text-cyan-400' : 'text-fuchsia-400'}`}>DECK {deck}</div>
                  <input aria-label={`Deck ${deck} volume`} type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="mx-auto mt-1 h-24 w-5 accent-cyan-400 [writing-mode:vertical-lr]" />
                  <p className="mb-2 text-[8px] text-slate-600">{volume}%</p>
                  <div className="space-y-1">
                    {(['high', 'mid', 'low'] as (keyof Equalizer)[]).map((band) => (
                      <label key={band} className="block">
                        <span className="block text-[7px] text-slate-600">{band.toUpperCase()} {values[band]}dB</span>
                        <input aria-label={`Deck ${deck} ${band} EQ`} type="range" min="-12" max="12" value={values[band]} onChange={(event) => setValues((current) => ({ ...current, [band]: Number(event.target.value) }))} className={`w-full ${tint}`} />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-col items-center">
              <div className="text-[9px] font-black text-white">MASTER</div>
              <input aria-label="Master volume" type="range" min="0" max="100" value={master} onChange={(event) => setMaster(Number(event.target.value))} className="mx-auto mt-2 h-28 w-5 accent-cyan-400 [writing-mode:vertical-lr]" />
              <span className="text-[8px] text-slate-600">{master}%</span>
              <button type="button" onClick={() => setMonitorMuted((value) => !value)} title={monitorMuted ? 'Unmute output' : 'Mute output'} className={`mt-4 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#1b1e24] ${monitorMuted ? 'text-rose-400' : 'text-slate-400 hover:text-white'}`}>
                {monitorMuted ? <Volume2 className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-3">
            <div className="mb-2 flex justify-between text-[8px] font-bold text-slate-600"><span>A</span><span>CROSSFADER</span><span>B</span></div>
            <input aria-label="Crossfader" type="range" min="0" max="100" value={crossfade} onChange={(event) => setCrossfade(Number(event.target.value))} className="w-full accent-cyan-400" />
            <div className="mt-2">
          <p className="mb-1 text-[8px] font-bold tracking-wider text-slate-600">AUDIO FX · BOTH DECKS</p>
          <div className="grid grid-cols-3 gap-1">
            <button type="button" aria-pressed={fxMode === 'Low-pass' || fxMode === 'High-pass'} onClick={() => setFxMode(fxMode === 'Low-pass' ? 'High-pass' : fxMode === 'High-pass' ? 'Off' : 'Low-pass')} className={`border py-1.5 text-[7px] font-bold ${fxMode === 'Low-pass' || fxMode === 'High-pass' ? 'border-cyan-400/40 text-cyan-300' : 'border-white/5 text-slate-500'}`}>FILTER</button>
            <button type="button" aria-pressed={fxMode === 'Flanger'} onClick={() => setFxMode(fxMode === 'Flanger' ? 'Off' : 'Flanger')} className={`border py-1.5 text-[7px] font-bold ${fxMode === 'Flanger' ? 'border-fuchsia-400/40 text-fuchsia-300' : 'border-white/5 text-slate-500'}`}>FLANGER</button>
            <button type="button" aria-pressed={fxMode === 'Cut'} onClick={() => setFxMode(fxMode === 'Cut' ? 'Off' : 'Cut')} className={`border py-1.5 text-[7px] font-bold ${fxMode === 'Cut' ? 'border-rose-400/40 text-rose-300' : 'border-white/5 text-slate-500'}`}>CUT</button>
          </div>
          <p className="mt-1 text-right text-[7px] text-slate-600">{fxMode === 'Off' ? 'BYPASS' : fxMode.toUpperCase()}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {padNotes.slice(0, 4).map((pad) => <button key={pad.label} type="button" onClick={() => void triggerPad(pad.frequency, pad.type)} className="rounded-md border border-white/5 bg-[#1b1e24] py-3 text-[8px] font-bold text-slate-400 hover:border-fuchsia-400/40 hover:text-fuchsia-300">{pad.label}</button>)}
            </div>
          </div>
        </aside>
      </div>

      <footer className="border-t border-white/5 bg-[#090b0d] px-3 py-2 text-center text-[9px] text-slate-500">
        Developed by <span className="font-semibold tracking-wide text-slate-300">Leonard Alindato</span>
      </footer>

      {showVideoPreview && videoUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowVideoPreview(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="video-preview-title" className="w-full max-w-4xl rounded-xl border border-white/10 bg-[#15181d] p-3 shadow-2xl sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="video-preview-title" className="text-sm font-bold text-white">LOCAL VIDEO PREVIEW</h2>
                <p className="truncate text-[10px] text-slate-500" title={videoName}>{videoName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => videoPicker.current?.click()} className="rounded-md border border-white/10 px-2 py-1.5 text-[9px] font-bold text-slate-300 hover:border-cyan-400/30 hover:text-cyan-300">OPEN VIDEO</button>
                <button type="button" onClick={() => setShowVideoPreview(false)} aria-label="Close video preview" className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <video key={videoUrl} src={videoUrl} controls playsInline className="max-h-[70vh] w-full rounded-lg bg-black" onError={() => setVideoError('This video format cannot be played in this browser.')} />
            {videoError && <p role="alert" className="mt-2 text-[10px] text-rose-300">{videoError}</p>}
            <p className="mt-2 text-[10px] text-slate-500">Video plays locally; its audio is not routed through the DJ mixer.</p>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSettings(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-sm rounded-xl border border-white/10 bg-[#171a20] p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="settings-title" className="text-sm font-bold text-white">Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} aria-label="Close settings" className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <label className="mb-3 block text-[11px] text-slate-300">
              Default deck for imported files
              <select value={defaultDeck} onChange={(event) => setDefaultDeck(event.target.value as Deck)} className="mt-1 w-full rounded-md border border-white/10 bg-[#0b0d10] p-2 text-xs">
                <option value="A">Deck A</option><option value="B">Deck B</option>
              </select>
            </label>
            <label className="mb-3 block text-[11px] text-slate-300">
              Voice command language
              <select aria-label="Voice command language" value={voiceLanguage} disabled={voiceListening} onChange={(event) => setVoiceLanguage(event.target.value as VoiceLanguage)} className="mt-1 w-full rounded-md border border-white/10 bg-[#0b0d10] p-2 text-xs disabled:opacity-50">
                <option value="en-US">English</option>
                <option value="fil-PH">Filipino</option>
              </select>
              <span className="mt-1 block text-[10px] text-slate-500">
                Stop voice control before changing language. Filipino commands include “patugtugin A”, “ihinto B”, and “sunod na kanta”.
              </span>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={autoPlayLoaded} onChange={(event) => setAutoPlayLoaded(event.target.checked)} className="accent-cyan-400" />
              Start playback when loading a track
            </label>
            <p className="mt-4 text-[10px] leading-relaxed text-slate-500">MixWave works with local audio files. Streaming service account linking requires each provider's approved API and is not enabled in this prototype.</p>
          </section>
        </div>
      )}
    </div>
  );
}
