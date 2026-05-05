
import React, { useState, useEffect, useRef } from 'react';
import { TUNER_NOTES } from '../constants';

const Tuner: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [closestNote, setClosestNote] = useState<typeof TUNER_NOTES[0] | null>(null);
  const [centsOffset, setCentsOffset] = useState<number>(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasPermission, setHasPermission] = useState(false);
  
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);

  // Busca dispositivos disponíveis
  const getDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
      setDevices(audioInputs);
      
      // Se houver dispositivos e nenhum selecionado, seleciona o primeiro
      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Erro ao listar dispositivos:', err);
    }
  };

  // Solicita permissão e atualiza nomes dos dispositivos
  const requestPermission = async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(track => track.stop()); // Para o stream temporário
      setHasPermission(true);
      await getDevices(); // Agora os nomes (labels) aparecerão
    } catch (err) {
      console.error('Permissão negada:', err);
      alert("Para afinar, precisamos acessar seu microfone. Por favor, autorize o acesso.");
    }
  };

  useEffect(() => {
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  // Inicia o afinador com o dispositivo selecionado
  const startTuner = async () => {
    try {
      if (stream.current) {
        stream.current.getTracks().forEach(t => t.stop());
      }

      const constraints = { 
        audio: { 
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      };

      const userStream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.current = userStream;
      
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
      }
      
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 2048; 
      
      const source = audioContext.current.createMediaStreamSource(userStream);
      source.connect(analyser.current);
      
      setIsActive(true);
      updateFrequency();
    } catch (err: any) { 
      console.error(err);
      alert("Erro ao acessar o microfone selecionado."); 
      setIsActive(false); 
    }
  };

  const stopTuner = () => {
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    if (stream.current) stream.current.getTracks().forEach(t => t.stop());
    setIsActive(false); 
    setFrequency(null); 
    setClosestNote(null);
    setCentsOffset(0);
  };

  const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
    let size = buffer.length;
    let rms = 0;
    for (let i = 0; i < size; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return -1; 

    let c = new Float32Array(size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size - j; i++) {
        c[j] = c[j] + buffer[i] * buffer[i + j];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < size; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    
    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
  };

  const updateFrequency = () => {
    if (!analyser.current || !audioContext.current) return;
    
    const bufferLength = analyser.current.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.current.getFloatTimeDomainData(dataArray);
    
    const freq = autoCorrelate(dataArray, audioContext.current.sampleRate);
    
    if (freq !== -1 && freq > 60 && freq < 1000) {
      setFrequency(freq);
      
      let minDiff = Infinity, found = TUNER_NOTES[0];
      TUNER_NOTES.forEach(n => {
        const diff = Math.abs(freq - n.freq);
        if (diff < minDiff) {
          minDiff = diff;
          found = n;
        }
      });
      setClosestNote(found);

      const cents = 1200 * Math.log2(freq / found.freq);
      setCentsOffset(cents);
    }
    
    animationFrame.current = requestAnimationFrame(updateFrequency);
  };

  const getTuningColor = () => {
    if (Math.abs(centsOffset) < 5) return 'text-emerald-500';
    if (Math.abs(centsOffset) < 15) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Se mudar o dispositivo enquanto ativo, reinicia o afinador
  useEffect(() => {
    if (isActive) {
      startTuner();
    }
  }, [selectedDeviceId]);

  return (
    <div className={`p-5 rounded-3xl shadow-sm border transition-colors dark:bg-slate-900 dark:border-slate-800 bg-white border-slate-200`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-500 uppercase tracking-widest">
          <span className="text-blue-500">🎸</span> Afinador de Precisão
        </h3>
        {isActive && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>}
      </div>
      
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Selecione o Microfone</label>
          <div className="flex gap-2">
            <select 
              value={selectedDeviceId} 
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className={`flex-1 border rounded-xl px-3 py-2.5 text-xs font-bold outline-none transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 bg-slate-50 border-slate-200 text-slate-700`}
            >
              {devices.length === 0 && <option value="">Nenhum dispositivo encontrado</option>}
              {devices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microfone ${idx + 1}`}
                </option>
              ))}
            </select>
            <button 
              onClick={requestPermission}
              title="Atualizar lista"
              className="p-2.5 rounded-xl border dark:border-slate-700 dark:bg-slate-800 bg-slate-50 border-slate-200 text-slate-400 hover:text-blue-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>

        <div className={`relative w-full h-32 flex flex-col items-center justify-center rounded-2xl overflow-hidden border transition-colors dark:bg-slate-800 dark:border-slate-700 bg-slate-50 border-slate-100`}>
          {isActive ? (
            <>
              <div className="absolute top-2 w-full px-4 flex flex-col items-center">
                <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full relative">
                  <div className="absolute left-1/2 -top-1 w-0.5 h-3 bg-slate-400 -translate-x-1/2 z-10"></div>
                  <div 
                    className={`absolute h-3 w-1 rounded-full -top-1 transition-all duration-75 ${Math.abs(centsOffset) < 5 ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ 
                      left: `${50 + Math.max(-50, Math.min(50, centsOffset))}%`,
                      transform: 'translateX(-50%)'
                    }}
                  ></div>
                </div>
                <div className="flex justify-between w-full text-[8px] font-bold text-slate-400 mt-1 uppercase">
                  <span>Bemol</span>
                  <span>Afinado</span>
                  <span>Sustenido</span>
                </div>
              </div>

              <div className="flex flex-col items-center mt-4">
                <span className={`text-5xl font-black transition-colors duration-200 ${getTuningColor()}`}>
                  {closestNote && frequency ? closestNote.note : '--'}
                </span>
                {frequency && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-400">{frequency.toFixed(2)} Hz</span>
                    <span className={`text-[10px] font-black ${getTuningColor()}`}>
                      {centsOffset > 0 ? '+' : ''}{centsOffset.toFixed(0)} cents
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-300 dark:text-slate-700 opacity-20">
               <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
               </svg>
            </div>
          )}
        </div>

        <button
          onClick={isActive ? stopTuner : startTuner}
          className={`w-full py-3 rounded-2xl font-black text-sm transition-all shadow-md ${
            isActive ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
          }`}
        >
          {isActive ? 'DESATIVAR AFINADOR' : 'ATIVAR AFINADOR'}
        </button>
      </div>
    </div>
  );
};

export default Tuner;
