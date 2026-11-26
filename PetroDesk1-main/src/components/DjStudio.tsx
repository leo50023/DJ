import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AudioLines,
  ChevronDown,
  CircleUserRound,
  Cloud,
  FolderOpen,
  Headphones,
  Library,
  ListMusic,
  Mic2,
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
  Upload,
  Volume2,
  Youtube,
} from 'lucide-react';

type Deck = 'A' | 'B';

type Track = {
  title: string;
  artist: string;
  duration: string;
  source: string;
  color: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const library: Track[] = [
  { title: 'Midnight Pulse', artist: 'Luna Nova', duration: '03:48', source: 'Local', color: 'from-fuchsia-500 to-violet-700' },
  { title: 'Neon Skyline', artist: 'The Satellites', duration: '04:12', source: 'Spotify', color: 'from-emerald-400 to-cyan-700' },
  { title: 'Electric Hearts', artist: 'Stereo Flow', duration: '03:56', source: 'YouTube', color: 'from-red-400 to-rose-700' },
  { title: 'Ocean Drive', artist: 'Aria Beats', duration: '05:03', source: 'SoundCloud', color: 'from-orange-400 to-amber-700' },
  { title: 'After Hours', artist: 'Mono Club', duration: '03:32', source: 'Apple Music', color: 'from-pink-400 to-red-700' },
];

function Waveform({ active = false }: { active?: boolean }) {
  const bars = [24, 44, 32, 58, 68, 38, 52, 76, 64, 46, 82, 56, 34, 72, 48, 62, 88, 54, 40, 70, 84, 50, 36, 66, 78, 42, 60, 30, 74, 52];
  return (
    <div className="h-20 flex items-center gap-[3px] overflow-hidden rounded-lg border border-white/5 bg-black/20 px-2">
      {bars.map((height, index) => (
        <div
          key={index}
          className={`min-w-[3px] flex-1 rounded-full ${active ? 'bg-cyan-400' : 'bg-slate-500/80'}`}
          style={{ height: `${height}%`, opacity: 0.45 + (index % 5) * 0.12 }}
        />
      ))}
      {active && <div className="absolute left-[38%] top-0 h-full w-px bg-white/80 shadow-[0_0_8px_white]" />}
    </div>
  );
}

function DeckPanel({ deck, track, audioRef, playing, onToggle, onFile }: {
  deck: Deck;
  track: Track | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playing: boolean;
  onToggle: () => void;
  onFile: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const accent = deck === 'A' ? 'text-cyan-400' : 'text-fuchsia-400';
  const border = deck === 'A' ? 'border-cyan-400/30' : 'border-fuchsia-400/30';

  return (
    <section className={`min-w-0 rounded-xl border ${border} bg-[#171a20] p-3 shadow-2xl`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-md bg-white/5 text-sm font-black ${accent}`}>{deck}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{track?.title || 'Load a track'}</p>
            <p className="truncate text-[11px] text-slate-500">{track?.artist || 'No track selected'}</p>
          </div>
        </div>
        <button onClick={() => fileRef.current?.click()} className="rounded-md border border-white/10 px-2 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/5">
          <FolderOpen className="mr-1 inline h-3.5 w-3.5" /> LOAD
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])}
        />
      </div>

      <div className="relative mb-3">
        <Waveform active={playing} />
      </div>

      <div className="grid grid-cols-[88px_1fr] gap-3">
        <div className="relative grid aspect-square place-items-center rounded-full border-[8px] border-[#0d0f13] bg-[radial-gradient(circle,_#454b55_0%,_#252931_55%,_#111318_56%)] shadow-inner">
          <div className={`h-[70%] w-[70%] rounded-full bg-gradient-to-br ${track?.color || 'from-slate-600 to-slate-800'} opacity-90`} />
          <div className="absolute h-3 w-3 rounded-full border-2 border-white/40 bg-[#17191e]" />
        </div>
        <div>
          <div className="grid grid-cols-3 gap-2">
            {['CUE', 'SYNC', 'LOOP'].map((label) => (
              <button key={label} className="h-8 rounded-md border border-white/10 bg-white/[0.03] text-[9px] font-bold text-slate-400 hover:text-white">{label}</button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button className="text-slate-500 hover:text-white"><SkipBack className="h-4 w-4" /></button>
            <button onClick={onToggle} className={`grid h-12 w-12 place-items-center rounded-full ${deck === 'A' ? 'bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,.25)]' : 'bg-fuchsia-400 text-black shadow-[0_0_20px_rgba(232,121,249,.25)]'}`}>
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>
            <button className="text-slate-500 hover:text-white"><SkipForward className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <audio ref={audioRef} />
    </section>
  );
}

export default function DjStudio() {
  const [activeSource, setActiveSource] = useState('Library');
  const [query, setQuery] = useState('');
  const [trackA, setTrackA] = useState<Track | null>(library[0]);
  const [trackB, setTrackB] = useState<Track | null>(library[1]);
  const [playingA, setPlayingA] = useState(false);
  const [playingB, setPlayingB] = useState(false);
  const [crossfade, setCrossfade] = useState(50);
  const [master, setMaster] = useState(82);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const audioA = useRef<HTMLAudioElement>(null);
  const audioB = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (audioA.current) audioA.current.volume = (100 - crossfade) / 100;
    if (audioB.current) audioB.current.volume = crossfade / 100;
  }, [crossfade]);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const openOfficialSearch = () => {
    const search = encodeURIComponent(query || 'DJ music');
    const urls: Record<string, string> = {
      YouTube: `https://www.youtube.com/results?search_query=${search}`,
      Spotify: `https://open.spotify.com/search/${search}`,
      SoundCloud: `https://soundcloud.com/search?q=${search}`,
      'Apple Music': `https://music.apple.com/us/search?term=${search}`,
    };
    const url = urls[activeSource];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filtered = library.filter((track) =>
    `${track.title} ${track.artist} ${track.source}`.toLowerCase().includes(query.toLowerCase())
  );

  const toggleDeck = (deck: Deck) => {
    const audio = deck === 'A' ? audioA.current : audioB.current;
    if (!audio?.src) return;
    if (deck === 'A') {
      if (audio.paused) {
        audio.play();
        setPlayingA(true);
      } else {
        audio.pause();
        setPlayingA(false);
      }
    } else {
      if (audio.paused) {
        audio.play();
        setPlayingB(true);
      } else {
        audio.pause();
        setPlayingB(false);
      }
    }
  };

  const loadFile = (deck: Deck, file: File) => {
    const url = URL.createObjectURL(file);
    const audio = deck === 'A' ? audioA.current : audioB.current;
    if (audio) {
      audio.src = url;
      audio.volume = deck === 'A' ? (100 - crossfade) / 100 : crossfade / 100;
      audio.play();
    }
    const track: Track = {
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Local file',
      duration: 'Loaded',
      source: 'Local',
      color: deck === 'A' ? 'from-cyan-400 to-blue-700' : 'from-fuchsia-400 to-purple-800',
    };
    if (deck === 'A') {
      setTrackA(track);
      setPlayingA(true);
    } else {
      setTrackB(track);
      setPlayingB(true);
    }
  };

  const sources = [
    { name: 'Library', icon: Library },
    { name: 'YouTube', icon: Youtube },
    { name: 'Spotify', icon: Radio },
    { name: 'SoundCloud', icon: Cloud },
    { name: 'Apple Music', icon: Music2 },
  ];

  return (
    <div className="h-[100dvh] min-h-[620px] overflow-y-auto bg-[#0b0d10] text-slate-200">
      <header className="flex h-14 items-center border-b border-white/5 bg-[#111318] px-4">
        <div className="flex w-auto items-center gap-2 md:w-44">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black">
            <AudioLines className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight text-white">MIXWAVE</p>
            <p className="text-[9px] font-bold tracking-[0.2em] text-cyan-400">PRO DJ</p>
          </div>
        </div>
        <nav className="hidden h-full items-center gap-6 sm:flex">
          {['DECKS', 'SAMPLER', 'PAD FX', 'RECORDER'].map((item) => (
            <button key={item} className={`h-full border-b-2 text-[10px] font-bold tracking-wider ${item === 'DECKS' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>{item}</button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {installPrompt && (
            <button onClick={installApp} className="hidden rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-1.5 text-[9px] font-bold text-cyan-400 sm:block">
              INSTALL APP
            </button>
          )}
          <span className="hidden items-center gap-1.5 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-400 sm:flex">
            <Activity className="h-3 w-3" /> ONLINE
          </span>
          <button className="rounded-md p-2 text-slate-400 hover:bg-white/5"><MonitorPlay className="h-4 w-4" /></button>
          <button className="rounded-md p-2 text-slate-400 hover:bg-white/5"><Settings className="h-4 w-4" /></button>
          <button className="ml-1 rounded-full bg-slate-700 p-1.5"><CircleUserRound className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid h-[calc(100%-56px)] grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_220px]">
        <aside className="hidden border-r border-white/5 bg-[#111318] p-3 md:block">
          <p className="mb-2 px-2 text-[9px] font-bold tracking-[0.18em] text-slate-600">MUSIC SOURCES</p>
          <div className="space-y-1">
            {sources.map((source) => {
              const Icon = source.icon;
              return (
                <button
                  key={source.name}
                  onClick={() => setActiveSource(source.name)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs ${activeSource === source.name ? 'bg-cyan-400/10 text-cyan-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon className="h-4 w-4" /><span>{source.name}</span>
                  {source.name !== 'Library' && <span className="ml-auto text-[8px] text-slate-600">LINK</span>}
                </button>
              );
            })}
          </div>
          <p className="mb-2 mt-6 px-2 text-[9px] font-bold tracking-[0.18em] text-slate-600">PLAYLISTS</p>
          {['Warm-up Set', 'Friday Night', 'Unreleased'].map((name) => (
            <button key={name} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white">
              <ListMusic className="h-3.5 w-3.5" />{name}
            </button>
          ))}
        </aside>

        <main className="min-w-0 overflow-y-auto p-3">
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DeckPanel deck="A" track={trackA} audioRef={audioA} playing={playingA} onToggle={() => toggleDeck('A')} onFile={(file) => loadFile('A', file)} />
            <DeckPanel deck="B" track={trackB} audioRef={audioB} playing={playingB} onToggle={() => toggleDeck('B')} onFile={(file) => loadFile('B', file)} />
          </div>

          <section className="rounded-xl border border-white/5 bg-[#15181d] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">{activeSource}</p>
                <p className="text-[10px] text-slate-500">{filtered.length} tracks</p>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="ml-auto flex h-8 w-full max-w-xs items-center rounded-md border border-white/5 bg-black/20 px-2">
                  <Search className="h-3.5 w-3.5 text-slate-500" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tracks" className="w-full bg-transparent px-2 text-xs outline-none placeholder:text-slate-600" />
                </div>
                {activeSource !== 'Library' && (
                  <button onClick={openOfficialSearch} className="h-8 shrink-0 rounded-md border border-cyan-400/20 px-2 text-[9px] font-bold text-cyan-400 hover:bg-cyan-400/10">
                    OPEN
                  </button>
                )}
                <button className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/5 text-slate-400"><SlidersHorizontal className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
              {filtered.map((track) => (
                <button
                  key={track.title}
                  onClick={() => {
                    const emptyDeck = !trackA ? 'A' : !trackB ? 'B' : 'A';
                    emptyDeck === 'A' ? setTrackA(track) : setTrackB(track);
                  }}
                  className="group min-w-0 rounded-lg border border-white/5 bg-[#1b1e24] p-2 text-left hover:border-cyan-400/30"
                >
                  <div className={`relative mb-2 h-20 rounded-md bg-gradient-to-br ${track.color} overflow-hidden`}>
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,.12)_21%,transparent_22%)]" />
                    <div className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur group-hover:opacity-100">
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </div>
                  </div>
                  <p className="truncate text-xs font-bold text-white">{track.title}</p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">{track.artist}</p>
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className="hidden border-l border-white/5 bg-[#111318] p-3 md:block">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wider text-slate-400">MASTER MIXER</p>
            <Headphones className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="grid grid-cols-[1fr_44px_1fr] gap-2">
            {(['A', 'B'] as Deck[]).map((deck) => (
              <div key={deck} className="text-center">
                <div className={`text-[9px] font-black ${deck === 'A' ? 'text-cyan-400' : 'text-fuchsia-400'}`}>DECK {deck}</div>
                <div className="mx-auto mt-2 h-32 w-8 rounded-md border border-white/5 bg-black/20 p-1">
                  <input type="range" className="h-full w-6 rotate-[-90deg] translate-y-12 opacity-70" />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {['HI', 'MID', 'LOW'].map((eq) => (
                    <div key={eq}>
                      <div className="mx-auto h-10 w-2 rounded-full bg-slate-700"><div className="h-1/2 w-full rounded-full bg-cyan-400/70" /></div>
                      <p className="mt-1 text-[7px] text-slate-600">{eq}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col items-center">
              <div className="text-[9px] font-black text-white">MASTER</div>
              <div className="mt-2 flex h-32 items-center">
                <input aria-label="Master volume" type="range" min="0" max="100" value={master} onChange={(e) => setMaster(Number(e.target.value))} className="h-1 w-24 rotate-[-90deg] accent-cyan-400" />
              </div>
              <div className="mt-4 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-[#1b1e24]">
                <Mic2 className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>
          <div className="mt-5 border-t border-white/5 pt-4">
            <div className="mb-2 flex justify-between text-[8px] font-bold text-slate-600"><span>A</span><span>CROSSFADER</span><span>B</span></div>
            <input aria-label="Crossfader" type="range" min="0" max="100" value={crossfade} onChange={(e) => setCrossfade(Number(e.target.value))} className="w-full accent-cyan-400" />
            <div className="mt-4 grid grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((pad) => (
                <button key={pad} className="aspect-square rounded-md border border-white/5 bg-[#1b1e24] text-[8px] font-bold text-slate-500 hover:border-fuchsia-400/40 hover:text-fuchsia-400">{pad}</button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
