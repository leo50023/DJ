import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Clock3, Plus, Radio, Trash2 } from 'lucide-react';

export type TrackMood = 'Warm-up' | 'Groove' | 'Peak' | 'Chill' | 'Closing';

export type SmartTrack = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  energy: number;
  mood: TrackMood;
  playCount: number;
  addedAt: number;
};

export type ShowCue = {
  id: string;
  title: string;
  atSeconds: number;
  completed: boolean;
};

export type SessionSummary = {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  plays: number;
  uniqueTracks: number;
  recordings: number;
};

export type ShortcutAction =
  | 'playA'
  | 'playB'
  | 'cueA'
  | 'cueB'
  | 'loopA'
  | 'loopB'
  | 'record'
  | 'macro1'
  | 'macro2'
  | 'macro3'
  | 'macro4';

export type ShortcutMap = Record<ShortcutAction, string>;

export type MacroAction =
  | 'play-a'
  | 'play-b'
  | 'kick'
  | 'snare'
  | 'fade-a'
  | 'fade-b'
  | 'low-pass'
  | 'high-pass'
  | 'record';

export type MacroMap = Record<1 | 2 | 3 | 4, MacroAction>;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  playA: 'a',
  playB: 's',
  cueA: 'q',
  cueB: 'w',
  loopA: 'z',
  loopB: 'x',
  record: 'r',
  macro1: '1',
  macro2: '2',
  macro3: '3',
  macro4: '4',
};

export const DEFAULT_MACROS: MacroMap = {
  1: 'play-a',
  2: 'play-b',
  3: 'kick',
  4: 'fade-b',
};

const MOODS: TrackMood[] = ['Warm-up', 'Groove', 'Peak', 'Chill', 'Closing'];
const ACTION_LABELS: Record<ShortcutAction, string> = {
  playA: 'Play / pause deck A',
  playB: 'Play / pause deck B',
  cueA: 'Cue deck A',
  cueB: 'Cue deck B',
  loopA: 'Toggle loop deck A',
  loopB: 'Toggle loop deck B',
  record: 'Start / stop recording',
  macro1: 'Run macro 1',
  macro2: 'Run macro 2',
  macro3: 'Run macro 3',
  macro4: 'Run macro 4',
};

const MACRO_LABELS: Record<MacroAction, string> = {
  'play-a': 'Play / pause deck A',
  'play-b': 'Play / pause deck B',
  kick: 'Trigger kick sampler',
  snare: 'Trigger snare sampler',
  'fade-a': 'Crossfade to deck A',
  'fade-b': 'Crossfade to deck B',
  'low-pass': 'Enable low-pass effect',
  'high-pass': 'Enable high-pass effect',
  record: 'Start / stop recording',
};

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m ${remainder}s`;
}

export function SetPlanner({
  tracks,
  planIds,
  onPlanChange,
  onLoadTrack,
  onTagChange,
}: {
  tracks: SmartTrack[];
  planIds: string[];
  onPlanChange: (ids: string[]) => void;
  onLoadTrack: (deck: 'A' | 'B', track: SmartTrack) => void;
  onTagChange: (id: string, update: { energy?: number; mood?: TrackMood }) => void;
}) {
  const [arc, setArc] = useState<'build' | 'wave' | 'cool'>('build');
  const plannedTracks = planIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is SmartTrack => Boolean(track));
  const availableTracks = tracks.filter((track) => !planIds.includes(track.id));
  const totalSeconds = plannedTracks.reduce((sum, track) => {
    const [minutes, seconds] = track.duration.split(':').map(Number);
    return sum + (Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : 0);
  }, 0);

  const buildPlan = () => {
    const sorted = [...tracks].sort((a, b) => a.energy - b.energy || a.playCount - b.playCount || a.title.localeCompare(b.title));
    if (arc === 'cool') sorted.reverse();
    if (arc === 'wave' && sorted.length > 2) {
      const midpoint = Math.ceil(sorted.length / 2);
      onPlanChange([...sorted.slice(0, midpoint), ...sorted.slice(midpoint).reverse()].map((track) => track.id));
      return;
    }
    onPlanChange(sorted.map((track) => track.id));
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= planIds.length) return;
    const next = [...planIds];
    [next[index], next[target]] = [next[target], next[index]];
    onPlanChange(next);
  };

  return (
    <section className="space-y-3 rounded-xl border border-white/5 bg-[#15181d] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">SMART SET PLANNER</h2>
          <p className="mt-1 text-[10px] text-slate-500">Build an energy arc using your own track ratings and local play history.</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Set energy arc" value={arc} onChange={(event) => setArc(event.target.value as typeof arc)} className="rounded-md border border-white/10 bg-[#0b0d10] px-2 py-2 text-[10px] text-slate-300">
            <option value="build">Warm up → peak</option>
            <option value="wave">Warm up → peak → cool</option>
            <option value="cool">Peak → cool down</option>
          </select>
          <button type="button" onClick={buildPlan} disabled={!tracks.length} className="rounded-md bg-cyan-400 px-3 py-2 text-[10px] font-bold text-black disabled:opacity-40">BUILD SMART SET</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
        <span>{plannedTracks.length} planned tracks</span>
        <span>Estimated play time: {formatDuration(totalSeconds)}</span>
      </div>

      {plannedTracks.length ? (
        <ol className="space-y-2">
          {plannedTracks.map((track, index) => (
            <li key={`${track.id}-${index}`} className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#1b1e24] p-2">
              <span className="w-5 text-center font-mono text-[10px] text-cyan-300">{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{track.title}</p>
                <p className="truncate text-[9px] text-slate-500">{track.artist} · energy {track.energy}/5 · {track.mood} · played {track.playCount}×</p>
              </div>
              <button type="button" onClick={() => moveTrack(index, -1)} disabled={index === 0} title="Move up" aria-label={`Move ${track.title} up`} className="p-1 text-slate-400 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => moveTrack(index, 1)} disabled={index === plannedTracks.length - 1} title="Move down" aria-label={`Move ${track.title} down`} className="p-1 text-slate-400 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => onLoadTrack('A', track)} className="rounded bg-cyan-400/10 px-2 py-1 text-[9px] font-bold text-cyan-300">LOAD A</button>
              <button type="button" onClick={() => onLoadTrack('B', track)} className="rounded bg-fuchsia-400/10 px-2 py-1 text-[9px] font-bold text-fuchsia-300">LOAD B</button>
              <button type="button" onClick={() => onPlanChange(planIds.filter((id) => id !== track.id))} aria-label={`Remove ${track.title} from plan`} className="p-1 text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">Import tracks, rate their energy, then build your first set.</p>
      )}

      {availableTracks.length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-bold tracking-wider text-slate-500">AVAILABLE TRACKS</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableTracks.map((track) => (
              <div key={track.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/10 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-200">{track.title}</p>
                  <p className="truncate text-[9px] text-slate-500">{track.artist} · {track.playCount} plays</p>
                </div>
                <label className="text-[8px] text-slate-500">ENERGY
                  <select aria-label={`Energy for ${track.title}`} value={track.energy} onChange={(event) => onTagChange(track.id, { energy: Number(event.target.value) })} className="ml-1 rounded bg-[#0b0d10] p-1 text-[9px] text-slate-200">
                    {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </label>
                <label className="text-[8px] text-slate-500">MOOD
                  <select aria-label={`Mood for ${track.title}`} value={track.mood} onChange={(event) => onTagChange(track.id, { mood: event.target.value as TrackMood })} className="ml-1 max-w-24 rounded bg-[#0b0d10] p-1 text-[9px] text-slate-200">
                    {MOODS.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => onPlanChange([...planIds, track.id])} aria-label={`Add ${track.title} to set`} title="Add to set" className="rounded-md p-1.5 text-cyan-300 hover:bg-cyan-400/10"><Plus className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function ShowTimeline({
  cues,
  elapsed,
  startedAt,
  onStart,
  onReset,
  onAddCue,
  onCompleteCue,
  onRemoveCue,
}: {
  cues: ShowCue[];
  elapsed: number;
  startedAt: number | null;
  onStart: () => void;
  onReset: () => void;
  onAddCue: (title: string, atSeconds: number) => void;
  onCompleteCue: (id: string) => void;
  onRemoveCue: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(0);

  const submitCue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onAddCue(cleanTitle, Math.max(0, minutes) * 60);
    setTitle('');
  };

  const sortedCues = [...cues].sort((a, b) => a.atSeconds - b.atSeconds);
  const nextCue = sortedCues.find((cue) => !cue.completed);
  const secondsUntilCue = nextCue ? nextCue.atSeconds - elapsed : null;

  return (
    <section className="space-y-3 rounded-xl border border-white/5 bg-[#15181d] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">SHOW TIMELINE</h2>
          <p className="mt-1 text-[10px] text-slate-500">Plan cues against a local show clock. Times are relative to when you start.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-black/20 px-2 py-2 font-mono text-xs text-cyan-300"><Clock3 className="h-3.5 w-3.5" />{formatClock(elapsed)}</span>
          <button type="button" onClick={onStart} className="rounded-md bg-cyan-400 px-3 py-2 text-[10px] font-bold text-black">{startedAt ? 'RESTART CLOCK' : 'START SHOW'}</button>
          {startedAt && <button type="button" onClick={onReset} className="rounded-md border border-white/10 px-3 py-2 text-[10px] font-bold text-slate-400">RESET</button>}
        </div>
      </div>

      <form onSubmit={submitCue} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_auto]">
        <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Timeline cue name" placeholder="Cue name (e.g. welcome announcement)" className="rounded-md border border-white/10 bg-[#0b0d10] px-3 py-2 text-xs text-white placeholder:text-slate-600" />
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-[#0b0d10] px-2 text-[10px] text-slate-500">
          AT MINUTE
          <input type="number" min="0" max="600" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} aria-label="Cue minute" className="w-full bg-transparent py-2 text-xs text-white outline-none" />
        </label>
        <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-md border border-cyan-400/30 px-3 py-2 text-[10px] font-bold text-cyan-300"><Plus className="h-3.5 w-3.5" /> ADD CUE</button>
      </form>

      {nextCue && startedAt && secondsUntilCue !== null && secondsUntilCue <= 0 && (
        <div role="status" className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold text-amber-200">Cue due now: {nextCue.title}</div>
      )}
      {!sortedCues.length ? (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">Add a cue to build a simple run-of-show checklist.</p>
      ) : (
        <ol className="space-y-2">
          {sortedCues.map((cue) => {
            const remaining = cue.atSeconds - elapsed;
            const due = Boolean(startedAt && remaining <= 0 && !cue.completed);
            return (
              <li key={cue.id} className={`flex items-center gap-2 rounded-lg border p-2.5 ${cue.completed ? 'border-emerald-500/20 bg-emerald-500/5' : due ? 'border-amber-400/30 bg-amber-400/5' : 'border-white/5 bg-[#1b1e24]'}`}>
                <span className="w-12 shrink-0 font-mono text-xs text-cyan-300">{formatClock(cue.atSeconds)}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-xs font-semibold ${cue.completed ? 'text-slate-500 line-through' : 'text-white'}`}>{cue.title}</p>
                  <p className="text-[9px] text-slate-500">{cue.completed ? 'Completed' : !startedAt ? 'Waiting for show clock' : due ? 'Due now' : `In ${formatClock(remaining)}`}</p>
                </div>
                {!cue.completed && <button type="button" onClick={() => onCompleteCue(cue.id)} aria-label={`Complete cue ${cue.title}`} className="p-1.5 text-emerald-300"><Check className="h-4 w-4" /></button>}
                <button type="button" onClick={() => onRemoveCue(cue.id)} aria-label={`Remove cue ${cue.title}`} className="p-1.5 text-slate-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function SessionHistory({
  current,
  history,
  onFinish,
  now,
}: {
  current: { startedAt: number; plays: number; trackIds: string[]; recordings: number };
  history: SessionSummary[];
  onFinish: () => void;
  now: number;
}) {
  const elapsed = Math.max(0, Math.floor((now - current.startedAt) / 1000));
  return (
    <section className="space-y-3 rounded-xl border border-white/5 bg-[#15181d] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">PERFORMANCE HISTORY</h2>
          <p className="mt-1 text-[10px] text-slate-500">Session stats are stored locally on this device.</p>
        </div>
        <button type="button" onClick={onFinish} className="rounded-md bg-cyan-400 px-3 py-2 text-[10px] font-bold text-black">FINISH & SAVE SESSION</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Session time', formatDuration(elapsed)],
          ['Track plays', String(current.plays)],
          ['Unique tracks', String(current.trackIds.length)],
          ['Recorded mixes', String(current.recordings)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/5 bg-[#1b1e24] p-2.5">
            <p className="text-[9px] text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-[10px] font-bold tracking-wider text-slate-500">SAVED SESSIONS</h3>
        {history.length ? (
          <ol className="space-y-2">
            {[...history].reverse().map((session) => (
              <li key={session.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/5 bg-black/10 p-2.5 text-[10px]">
                <span className="font-semibold text-slate-200">{new Date(session.startedAt).toLocaleString()}</span>
                <span className="text-slate-400">{formatDuration(session.durationSeconds)}</span>
                <span className="text-slate-400">{session.plays} plays · {session.uniqueTracks} tracks</span>
                <span className="inline-flex items-center gap-1 text-slate-400"><Radio className="h-3 w-3" />{session.recordings} mixes</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">Finish a DJ session to save its stats here.</p>
        )}
      </div>
    </section>
  );
}

export function KeyboardMacros({
  shortcuts,
  macros,
  shortcutError,
  onShortcutChange,
  onMacroChange,
  onReset,
}: {
  shortcuts: ShortcutMap;
  macros: MacroMap;
  shortcutError: string;
  onShortcutChange: (action: ShortcutAction, key: string) => void;
  onMacroChange: (slot: 1 | 2 | 3 | 4, action: MacroAction) => void;
  onReset: () => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-white/5 bg-[#15181d] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">KEYBOARD & PERFORMANCE MACROS</h2>
          <p className="mt-1 text-[10px] text-slate-500">Shortcuts work outside text fields. Click a key and press one letter, number, or symbol.</p>
        </div>
        <button type="button" onClick={onReset} className="rounded-md border border-white/10 px-3 py-2 text-[10px] font-bold text-slate-300">RESET DEFAULTS</button>
      </div>
      {shortcutError && <p role="alert" className="rounded-md border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-[10px] text-rose-200">{shortcutError}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(ACTION_LABELS) as ShortcutAction[]).map((action) => (
          <label key={action} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#1b1e24] p-2.5 text-[11px] text-slate-300">
            <span>{ACTION_LABELS[action]}</span>
            <input aria-label={`Shortcut for ${ACTION_LABELS[action]}`} value={shortcuts[action]} maxLength={1} onChange={(event) => onShortcutChange(action, event.target.value)} className="w-12 rounded-md border border-white/10 bg-[#0b0d10] p-2 text-center font-mono font-bold uppercase text-cyan-300 outline-none focus:border-cyan-400/50" />
          </label>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-[10px] font-bold tracking-wider text-slate-500">CONFIGURABLE MACRO PADS</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([1, 2, 3, 4] as const).map((slot) => (
            <label key={slot} className="rounded-lg border border-white/5 bg-[#1b1e24] p-2.5 text-[10px] text-slate-400">
              MACRO {slot} · KEY {shortcuts[`macro${slot}`].toUpperCase()}
              <select aria-label={`Macro ${slot} action`} value={macros[slot]} onChange={(event) => onMacroChange(slot, event.target.value as MacroAction)} className="mt-2 w-full rounded-md bg-[#0b0d10] p-2 text-[10px] text-slate-200">
                {(Object.keys(MACRO_LABELS) as MacroAction[]).map((action) => <option key={action} value={action}>{MACRO_LABELS[action]}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>
      <p className="text-[9px] text-slate-600">Default keys: A/S play · Q/W cue · Z/X loop · R record · 1–4 macros. Changes save on this device.</p>
    </section>
  );
}
