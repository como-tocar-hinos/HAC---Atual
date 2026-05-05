
import React, { useState, useEffect, useRef, useCallback } from 'react';

const Metronome: React.FC = () => {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const timer = useRef<number | null>(null);

  const playClick = useCallback(() => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const osc = audioContext.current.createOscillator();
    const envelope = audioContext.current.createGain();
    osc.frequency.value = 880;
    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(0.001, audioContext.current.currentTime + 0.1);
    osc.connect(envelope);
    envelope.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + 0.1);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const interval = (60 / bpm) * 1000;
      timer.current = window.setInterval(playClick, interval);
    } else {
      if (timer.current) clearInterval(timer.current);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [isPlaying, bpm, playClick]);

  return (
    <div className={`p-5 rounded-3xl shadow-sm border transition-colors dark:bg-slate-900 dark:border-slate-800 bg-white border-slate-200`}>
      <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase tracking-widest">
        <span className="text-red-500">⏱️</span> Metrônomo
      </h3>
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl font-mono font-bold dark:text-white text-slate-800">
          {bpm} <span className="text-xs font-sans text-slate-400">BPM</span>
        </div>
        <input
          type="range" min="40" max="240" value={bpm}
          onChange={(e) => setBpm(parseInt(e.target.value))}
          className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
        />
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`w-full py-2.5 rounded-2xl font-bold transition-all shadow-sm ${
            isPlaying ? 'bg-red-50 dark:bg-red-500/10 text-red-600 border border-red-100 dark:border-red-500/20' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-100'
          }`}
        >
          {isPlaying ? 'Parar' : 'Iniciar'}
        </button>
      </div>
    </div>
  );
};

export default Metronome;
