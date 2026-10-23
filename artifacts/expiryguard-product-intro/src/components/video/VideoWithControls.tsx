import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  scene1: { title: 'Expiry hook', filePath: 'src/components/video/scenes/Scene1.tsx' },
  scene2: { title: 'One workspace', filePath: 'src/components/video/scenes/Scene2.tsx' },
  scene3: { title: 'Pantry tracking', filePath: 'src/components/video/scenes/Scene3.tsx' },
  scene4: { title: 'Demand context', filePath: 'src/components/video/scenes/Scene4.tsx' },
  scene5: { title: 'Owner decisions', filePath: 'src/components/video/scenes/Scene5.tsx' },
  scene6: { title: 'Experimental AI boundary', filePath: 'src/components/video/scenes/Scene6.tsx' },
  scene7: { title: 'Brand close', filePath: 'src/components/video/scenes/Scene7.tsx' },
};
const PROGRESS_TICK_MS = 60;

function announceSceneSelection(index: number, sceneKeys: string[]) {
  const key = sceneKeys[index];
  const details = SCENE_DETAILS[key];
  if (!details?.filePath) return;
  window.parent.postMessage({
    type: 'REPLIT_VIDEO_SCENE_SELECTED',
    payload: { sceneIndex: index, sceneCount: sceneKeys.length, sceneTitle: details.title, filePath: details.filePath, lineNumber: 1 },
  }, '*');
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const {
    sceneKeys, activeIndex, locked, paused, mountKey, tick, durations, activeDuration,
    activeStartTime, totalDuration, onSceneChange, jumpTo, toggleLock, togglePause,
  } = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    announceSceneSelection(index, sceneKeys);
  }, [jumpTo, sceneKeys]);
  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed(value => {
      if (!value) { setHovering(false); setTapPinned(false); }
      return !value;
    });
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      if (sensorRef.current && !sensorRef.current.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [collapsed, tapPinned]);

  useEffect(() => {
    if (!paused) return;
    const frozen = document.getAnimations().filter(animation => animation.playState === 'running');
    frozen.forEach(animation => animation.pause());
    return () => frozen.forEach(animation => animation.play());
  }, [paused]);

  if (!isIframed) return <VideoTemplate />;
  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <VideoTemplate key={mountKey} durations={durations} loop paused={paused} muted={muted} onSceneChange={onSceneChange} />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="w-full flex-1" aria-hidden="true" />
        <div className={`flex items-center gap-[1.1vmin] border-t border-white/10 bg-[#29263f]/90 px-[1.3vmin] py-[.9vmin] text-[#f6f1e5] backdrop-blur-md transition-all duration-200 ease-out ${barVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`} aria-hidden={!barVisible}>
          <button type="button" onClick={togglePause} className="grid h-[5.5vmin] w-[5.5vmin] shrink-0 place-items-center rounded-[.8vmin] text-white/75 hover:bg-white/10 hover:text-white" title={paused ? 'Play' : 'Pause'} aria-label={paused ? 'Play' : 'Pause'}>
            {paused ? <Play className="h-[2.6vmin] w-[2.6vmin]" /> : <Pause className="h-[2.6vmin] w-[2.6vmin]" />}
          </button>
          <button type="button" onClick={toggleLock} className={`grid h-[5.5vmin] w-[5.5vmin] shrink-0 place-items-center rounded-[.8vmin] ${locked ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`} title={locked ? 'Loop current scene: on' : 'Loop current scene: off'} aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'} aria-pressed={locked}>
            <Repeat className="h-[2.6vmin] w-[2.6vmin]" />
          </button>
          <button type="button" onClick={() => setMuted(value => !value)} className="grid h-[5.5vmin] w-[5.5vmin] shrink-0 place-items-center rounded-[.8vmin] text-white/65 hover:bg-white/10 hover:text-white" title={muted ? 'Unmute audio' : 'Mute audio'} aria-label={muted ? 'Unmute audio' : 'Mute audio'} aria-pressed={muted}>
            {muted ? <VolumeX className="h-[2.6vmin] w-[2.6vmin]" /> : <Volume2 className="h-[2.6vmin] w-[2.6vmin]" />}
          </button>
          <div className="my-[.7vmin] w-px self-stretch bg-white/15" aria-hidden="true" />
          <PlaybackStatus sceneKeys={sceneKeys} activeIndex={activeIndex} activeDuration={activeDuration} activeStartTime={activeStartTime} totalDuration={totalDuration} tick={tick} paused={paused} onJumpTo={handleJumpTo} />
          <button type="button" onClick={handleToggleCollapsed} className="grid h-[5.5vmin] w-[5.5vmin] shrink-0 place-items-center rounded-[.8vmin] text-white/65 hover:bg-white/10 hover:text-white" title={collapsed ? 'Show controls' : 'Hide controls'} aria-label={collapsed ? 'Show controls' : 'Hide controls'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronUp className="h-[3.1vmin] w-[3.1vmin]" /> : <ChevronDown className="h-[3.1vmin] w-[3.1vmin]" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaybackStatus({
  sceneKeys, activeIndex, activeDuration, activeStartTime, totalDuration, tick, paused, onJumpTo,
}: {
  sceneKeys: string[]; activeIndex: number; activeDuration: number; activeStartTime: number;
  totalDuration: number; tick: number; paused: boolean; onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);
  useEffect(() => { setElapsed(0); elapsedBaseRef.current = 0; }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(elapsedBaseRef.current + performance.now() - start), PROGRESS_TICK_MS);
    return () => {
      window.clearInterval(id);
      elapsedBaseRef.current += performance.now() - start;
    };
  }, [tick, paused]);
  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));
  return (
    <>
      <div className="flex flex-1 items-center gap-[.55vmin]">
        {sceneKeys.map((key, index) => <button key={key} type="button" onClick={() => onJumpTo(index)} className="relative h-[1.2vmin] min-h-[8px] flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20 hover:bg-white/30" aria-label={`Jump to scene ${index + 1}`} aria-current={activeIndex === index ? 'true' : undefined}>
          <span className="absolute inset-y-0 left-0 rounded-full bg-[#e4f4cb]" style={{ width: `${activeIndex === index ? progress * 100 : activeIndex > index ? 100 : 0}%` }} />
        </button>)}
      </div>
      <div className="shrink-0 font-mono text-[1.55vmin] tabular-nums text-white/70">{activeIndex + 1}/{sceneKeys.length}</div>
      <div className="min-w-[10ch] shrink-0 text-right font-mono text-[1.45vmin] tabular-nums text-white/75" role="timer" aria-label={`Playback time ${formatTime(totalElapsed)} of ${formatTime(totalDuration)}`}>
        {formatTime(totalElapsed)} / {formatTime(totalDuration)}
      </div>
    </>
  );
}

function formatTime(durationMs: number) {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
