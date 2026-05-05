
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, useDragControls, AnimatePresence } from 'motion/react';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;
import { Hymn, InstrumentModality } from '../types';
import { transposeContent, transposeChord, isChordLine, getEmbedUrl } from '../utils/musicUtils';
import { supabase } from '../lib/supabase';
import Tuner from './Tuner';
import Metronome from './Metronome';
import BibleModal from './BibleModal';

interface ChordSheetProps {
  hymn: Hymn;
  isPro?: boolean;
  userId?: string;
}

const VOICE_PRESETS = [
  { label: 'Original', shift: 0 },
  { label: 'Baixo', shift: -4 },
  { label: 'Barítono', shift: -2 },
  { label: 'Tenor', shift: 2 },
  { label: 'Contralto', shift: -3 },
];

const ChordSheet: React.FC<ChordSheetProps> = ({ hymn, isPro = false, userId }) => {
  const [transposeCount, setTransposeCount] = useState(0);
  const [lastSavedTranspose, setLastSavedTranspose] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [scrollSpeed, setScrollSpeed] = useState(0);

  // Carregar e Salvar Configurações de Tom (Persistência)
  useEffect(() => {
    const loadHymnSettings = async () => {
      // 1. Tentar carregar do localStorage primeiro (mais rápido)
      const localKey = `hymn_transpose_${hymn.id}`;
      const savedTranspose = localStorage.getItem(localKey);
      
      if (savedTranspose !== null) {
        const val = parseInt(savedTranspose, 10);
        setTransposeCount(val);
        setLastSavedTranspose(val);
      } else {
        setTransposeCount(0); // Reset se não tiver nada salvo
      }

      // 2. Se tiver usuário, tentar sincronizar com o banco
      if (userId) {
        try {
          const { data, error } = await supabase
            .from('hymn_settings')
            .select('transpose_count')
            .eq('user_id', userId)
            .eq('hymn_id', hymn.id)
            .maybeSingle();
          
          if (error) {
            console.error("Erro Supabase ao buscar configurações:", error.message);
          } else if (data && data.transpose_count !== undefined) {
            setTransposeCount(data.transpose_count);
            setLastSavedTranspose(data.transpose_count);
            // Atualiza local também para consistência
            localStorage.setItem(localKey, data.transpose_count.toString());
          }
        } catch (e) {
          console.error("Exceção ao buscar configurações do hino:", e);
        }
      }
    };

    loadHymnSettings();
  }, [hymn.id, userId]);

  // Salvar sempre que mudar o transposeCount (com pequeno delay para evitar spam no banco)
  useEffect(() => {
    const saveHymnSettings = async () => {
      // Salva no localStorage (instantâneo)
      const localKey = `hymn_transpose_${hymn.id}`;
      localStorage.setItem(localKey, transposeCount.toString());

      // Sincroniza com o Supabase se logado
      if (userId) {
        console.log(`💾 Salvando tom ${transposeCount} para hino ${hymn.id} (ID tipo: ${typeof hymn.id}) do usuário ${userId}`);
        try {
          const { error } = await supabase
            .from('hymn_settings')
            .upsert({ 
              user_id: userId, 
              hymn_id: String(hymn.id), // Garantir que vai como string
              transpose_count: transposeCount,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,hymn_id' });
          
          if (error) {
            console.error("❌ Erro Supabase ao salvar tom:", error.message, error.details);
            // Se der erro de tipo, avisar o usuário no console
            if (error.message.includes('type')) {
              console.warn("DICA: Verifique se a coluna hymn_id na tabela hymn_settings é do tipo TEXT.");
            }
          } else {
            setLastSavedTranspose(transposeCount);
            console.log("✅ Tom sincronizado com a nuvem!");
          }
        } catch (e) {
          console.error("Exceção ao salvar tom do hino:", e);
        }
      } else {
        // Se não logado, apenas atualizamos o estado visual do "último salvo" localmente
        setLastSavedTranspose(transposeCount);
      }
    };

    // Delay de 1s para não salvar a cada clique rápido no +/-
    const timer = setTimeout(saveHymnSettings, 1000);
    return () => clearTimeout(timer);
  }, [transposeCount, hymn.id, userId]);
  const [showBible, setShowBible] = useState(false);
  const [activeMiniPlayer, setActiveMiniPlayer] = useState<InstrumentModality | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [printCount, setPrintCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const PRINT_LIMIT = 10;

  // Carregar contagem de impressões do mês atual
  useEffect(() => {
    const fetchPrintCount = async () => {
      if (!userId) return;
      
      const now = new Date();
      const monthKey = `${now.getMonth() + 1}-${now.getFullYear()}`;
      
      try {
        const { data, error } = await supabase
          .from('print_usage')
          .select('count')
          .eq('user_id', userId)
          .eq('month_year', monthKey)
          .single();
        
        if (data) {
          setPrintCount(data.count);
        } else if (error && error.code === 'PGRST116') {
          // Não existe registro para este mês ainda, criar um
          await supabase
            .from('print_usage')
            .insert({ user_id: userId, month_year: monthKey, count: 0 });
          setPrintCount(0);
        }
      } catch (e) {
        console.error("Erro ao buscar limite de impressão:", e);
      }
    };

    fetchPrintCount();
  }, [userId]);

  const handlePrint = async () => {
    if (isPro && userId) {
      if (printCount >= PRINT_LIMIT) {
        alert(`Você atingiu o limite de ${PRINT_LIMIT} impressões por mês para sua conta Premium. Esse limite existe para evitar abusos e proteger o conteúdo.`);
        return;
      }

      const now = new Date();
      const monthKey = `${now.getMonth() + 1}-${now.getFullYear()}`;
      const newCount = printCount + 1;
      
      try {
        const { error } = await supabase
          .from('print_usage')
          .upsert({ 
            user_id: userId, 
            month_year: monthKey, 
            count: newCount 
          }, { onConflict: 'user_id,month_year' });

        if (error) throw error;
        setPrintCount(newCount);
      } catch (e) {
        console.error("Erro ao atualizar limite de impressão:", e);
        // Fallback local se o banco falhar por algum motivo
        setPrintCount(newCount);
      }
    }
    
    window.print();
  };
  
  // Update document title for printing
  useEffect(() => {
    const originalTitle = document.title;
    document.title = hymn.title;
    return () => {
      document.title = originalTitle;
    };
  }, [hymn.title]);

  // Dragging state for video player
  const [playerPos, setPlayerPos] = useState({ x: 20, y: 100 });
  const [isMinimized, setIsMinimized] = useState(false);
  const dragControls = useDragControls();

  // Initialize player position on first open or when closing/opening
  useEffect(() => {
    if (activeMiniPlayer) {
      const isMobile = window.innerWidth < 1024;
      const initialX = isMobile ? (window.innerWidth - 224) / 2 : window.innerWidth - 330;
      const initialY = isMobile ? 80 : Math.max(80, window.innerHeight - 550);
      
      // Reseta se mobile ou se estiver fora
      const isOutside = playerPos.x < 0 || playerPos.x > window.innerWidth || playerPos.y < 0 || playerPos.y > window.innerHeight;
      
      if (isMobile || (playerPos.x === 20 && playerPos.y === 100) || isOutside) {
        setPlayerPos({ x: initialX, y: initialY });
      }
    }
  }, [activeMiniPlayer]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const scrollPosRef = useRef<number>(0);

  const CIFRA_ORANGE = '#ff6b00';

  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const normalizedRawContent = useMemo(() => {
    if (!hymn.content) return '';
    return hymn.content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  }, [hymn.content]);

  // Content processing
  const currentContent = useMemo(() => transposeContent(normalizedRawContent, transposeCount), [normalizedRawContent, transposeCount]);
  const currentKeyDisplay = useMemo(() => transposeChord(hymn.original_key || 'C', transposeCount), [hymn.original_key, transposeCount]);
  const lastSavedKeyDisplay = useMemo(() => 
    lastSavedTranspose !== null ? transposeChord(hymn.original_key || 'C', lastSavedTranspose) : null
  , [hymn.original_key, lastSavedTranspose]);

  // Video logic
  const rawUrl = useMemo(() => {
    if (activeMiniPlayer === 'guitar') return hymn.video_url_guitar;
    if (activeMiniPlayer === 'piano') return hymn.video_url_piano;
    return null;
  }, [activeMiniPlayer, hymn]);

  const mediaInfo = useMemo(() => getEmbedUrl(rawUrl || ''), [rawUrl]);

  // Auto-scroll logic recalibrada para ser EXTREMAMENTE lenta e precisa (escala 0-5)
  const animateScroll = useCallback((time: number) => {
    if (lastTimeRef.current !== null && scrollContainerRef.current && scrollSpeed > 0) {
      const deltaTime = time - lastTimeRef.current;
      
      // Velocidade 1 = aprox 4 pixels por segundo (muito lento para leitura atenta)
      // Velocidade 5 = aprox 20 pixels por segundo (velocidade de performance normal)
      const pixelsPerMs = scrollSpeed * 0.004; 
      
      scrollPosRef.current += pixelsPerMs * deltaTime;
      scrollContainerRef.current.scrollTop = scrollPosRef.current;
      
      const maxScroll = scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight;
      if (scrollContainerRef.current.scrollTop >= maxScroll - 1) {
        setScrollSpeed(0);
        return;
      }
    }
    lastTimeRef.current = time;
    if (scrollSpeed > 0) {
      requestRef.current = requestAnimationFrame(animateScroll);
    }
  }, [scrollSpeed]);

  useEffect(() => {
    if (scrollSpeed > 0) {
      if (scrollContainerRef.current) {
        scrollPosRef.current = scrollContainerRef.current.scrollTop;
      }
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animateScroll);
    } else {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = null;
    }
    return () => { if (requestRef.current !== null) cancelAnimationFrame(requestRef.current); };
  }, [scrollSpeed, animateScroll]);

  const handleManualScroll = () => {
    if (scrollContainerRef.current && scrollSpeed > 0) {
      // Sincroniza a referência de posição com o scroll real (manual ou automático)
      // Isso evita que a animação "brigue" com o usuário quando ele tenta mover a tela.
      scrollPosRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  const renderLine = (line: string, idx: string | number, isChorusContext: boolean) => {
    const trimmed = line.trim().toLowerCase();
    if (trimmed === '' || ['[refrão]', '[coro]', '[fim do refrão]', '[fim]'].includes(trimmed)) return null;

    if (isChordLine(line)) {
      return (
        <div 
          key={idx} 
          className="chords-font chord-only font-bold" 
          style={{ 
            fontSize: `${fontSize}px`, 
            whiteSpace: 'pre', 
            lineHeight: '1',
            marginTop: '0.4em',
            marginBottom: '-0.5em',
            color: CIFRA_ORANGE 
          }}
        >
          {line.replace(/\[/g, '').replace(/\]/g, '')}
        </div>
      );
    }

    const parts = line.split(/(\[.*?\])/g);
    const segments: { chord: string | null; text: string }[] = [];
    let nextChord: string | null = null;
    parts.forEach(part => {
      if (part.startsWith('[') && part.endsWith(']')) nextChord = part.substring(1, part.length - 1);
      else { segments.push({ chord: nextChord, text: part }); nextChord = null; }
    });

    const textColor = isChorusContext ? (isDark ? '#fff' : '#000') : (isDark ? '#cbd5e1' : '#475569');

    return (
      <div key={idx} className="flex flex-wrap items-end mb-0">
        {segments.map((seg, sIdx) => (
          <div key={sIdx} className="relative inline-flex flex-col items-start leading-none">
            <div 
              style={{ 
                minHeight: '0.9em', 
                marginBottom: '-8px', 
                width: seg.text ? 0 : 'auto',
                position: 'relative'
              }}
            >
              <div 
                className="chords-font chord-only font-bold whitespace-nowrap" 
                style={{ 
                  fontSize: `${fontSize * 0.9}px`, 
                  visibility: seg.chord ? 'visible' : 'hidden', 
                  color: CIFRA_ORANGE,
                  position: seg.text ? 'absolute' : 'static',
                  left: 0,
                  bottom: 0
                }}
              >
                {seg.chord || '\u00A0'}
              </div>
            </div>
            <div 
              className="chords-font whitespace-pre" 
              style={{ 
                fontSize: `${fontSize}px`, 
                color: textColor, 
                fontWeight: isChorusContext ? 700 : 400, 
                lineHeight: '1.1' 
              }}
            >
              {seg.text || (seg.chord ? '' : '\u00A0')}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderedBlocks = useMemo(() => {
    const lines = currentContent.split('\n');
    const blocks: React.ReactNode[] = [];
    let currentBlock: string[] = [];
    let isInsideChorus = false;
    let chorusCount = 0;

    const pushBlock = (isChorus: boolean, isDuplicate: boolean) => {
      if (currentBlock.length === 0) return;
      const blockIdx = blocks.length;
      blocks.push(
        <div 
          key={`block-${blockIdx}`} 
          className={`print-page-break ${isDuplicate ? 'print:hidden' : ''}`}
        >
          {currentBlock.map((line, lIdx) => renderLine(line, `${blockIdx}-${lIdx}`, isChorus))}
        </div>
      );
      currentBlock = [];
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim().toLowerCase();
      
      if (trimmed === '[refrão]' || trimmed === '[coro]') {
        pushBlock(false, false);
        isInsideChorus = true;
        chorusCount++;
        return;
      }
      
      if (trimmed === '[fim do refrão]' || trimmed === '[fim]') {
        pushBlock(true, chorusCount > 1);
        isInsideChorus = false;
        return;
      }

      if (line.trim() === '') {
        pushBlock(isInsideChorus, isInsideChorus && chorusCount > 1);
        blocks.push(<div key={`spacer-${idx}`} className="print-spacer" style={{ height: `${fontSize * 1.5}px` }} />);
        return;
      }

      currentBlock.push(line);
    });

    pushBlock(isInsideChorus, isInsideChorus && chorusCount > 1);
    return blocks;
  }, [currentContent, fontSize, isDark]);

  const SidebarContent = () => (
    <div className="flex flex-col gap-5 no-print">
      {/* 1. Leitura Bíblica no Topo das Ferramentas */}
      <button 
        onClick={() => { setShowBible(true); setIsMobileMenuOpen(false); }} 
        className={`w-full py-4 rounded-3xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-3 border-2 ${isDark ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}
      >
        📖 LEITURA BÍBLICA
      </button>

      {/* Auto-scroll com botões + e - (0-5) */}
      <div className={`p-4 rounded-3xl border-2 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Auto-rolagem (0-5)</h3>
          <div className="flex items-center justify-between gap-2">
            <button 
              onClick={() => setScrollSpeed(s => Math.max(0, s - 1))} 
              className={`w-12 h-12 rounded-xl font-black text-xl transition-all active:scale-90 border-2 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
            >-</button>
            <div className="flex-1 text-center bg-slate-50 dark:bg-slate-800 py-1 rounded-xl border border-slate-100 dark:border-slate-700">
              <span className="text-2xl font-black text-orange-500">{scrollSpeed}</span>
              <span className="text-[8px] block font-black text-slate-400 uppercase">Velocidade</span>
            </div>
            <button 
              onClick={() => setScrollSpeed(s => Math.min(5, s + 1))} 
              className={`w-12 h-12 rounded-xl font-black text-xl transition-all active:scale-90 border-2 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
            >+</button>
          </div>
        </div>
        <div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Tamanho da Letra</h3>
          <div className="flex items-center justify-between gap-2">
             <button onClick={() => setFontSize(f => Math.max(10, f - 2))} className={`w-12 h-12 rounded-xl font-black text-xl border-2 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>-</button>
             <span className="text-sm font-black flex-1 text-center">{fontSize}px</span>
             <button onClick={() => setFontSize(f => Math.min(40, f + 2))} className={`w-12 h-12 rounded-xl font-black text-xl border-2 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>+</button>
          </div>
        </div>
      </div>

      {/* Video Player Selection */}
      <div className={`p-4 rounded-3xl border-2 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vídeos Demonstrativos</h3>
          <button 
            onClick={() => setShowSidebar(false)}
            className="hidden lg:block text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase"
          >
            Fechar
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <button 
            onClick={() => {
              setActiveMiniPlayer(activeMiniPlayer === 'guitar' ? null : 'guitar');
              setIsMobileMenuOpen(false);
            }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${activeMiniPlayer === 'guitar' ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
          >VIOLÃO</button>
          <button 
            onClick={() => {
              setActiveMiniPlayer(activeMiniPlayer === 'piano' ? null : 'piano');
              setIsMobileMenuOpen(false);
            }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${activeMiniPlayer === 'piano' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
          >PIANO</button>
        </div>
        <p className="text-[9px] font-bold text-slate-400 text-center uppercase leading-tight">O vídeo aparecerá flutuando sobre a cifra</p>
      </div>

      {/* Voice Presets (Transposition Shortcuts) */}
      <div className={`p-4 rounded-3xl border-2 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Presets de Voz (Tom)</h3>
        <div className="grid grid-cols-2 gap-2">
          {VOICE_PRESETS.map(preset => (
            <button 
              key={preset.label} 
              onClick={() => setTransposeCount(preset.shift)}
              className={`py-2 px-3 rounded-xl text-[10px] font-black transition-all ${transposeCount === preset.shift ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Controls */}
      <div className={`p-4 rounded-3xl border-2 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ajuste Fino de Tom</h3>
        <div className="flex items-center justify-between p-2 rounded-2xl border-2 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700">
          <button onClick={() => setTransposeCount(prev => prev - 1)} className="w-10 h-10 flex items-center justify-center shadow-md rounded-xl font-black text-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">-</button>
          <div className="flex flex-col items-center">
            <span className="text-xl font-black" style={{ color: CIFRA_ORANGE }}>{currentKeyDisplay}</span>
            <span className="text-[9px] font-black text-slate-500 uppercase">TOM</span>
          </div>
          <button onClick={() => setTransposeCount(prev => prev + 1)} className="w-10 h-10 flex items-center justify-center shadow-md rounded-xl font-black text-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">+</button>
        </div>
        {lastSavedKeyDisplay && (
          <p className="mt-2 text-center text-[9px] font-black text-slate-400 uppercase tracking-tighter">
            Salvo pela última vez em: <span className="text-orange-500">{lastSavedKeyDisplay}</span>
          </p>
        )}
      </div>

      <Metronome />
      <Tuner />

      <button onClick={handlePrint} className="w-full py-4 rounded-3xl font-black text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-3">
          🖨️ IMPRIMIR CIFRA
        </div>
        {isPro && (
          <span className="text-[9px] opacity-60 uppercase tracking-widest">
            {printCount} de {PRINT_LIMIT} este mês
          </span>
        )}
      </button>

      <button 
        onClick={() => setShowReportModal(true)}
        className="w-full py-2 text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest flex items-center justify-center gap-2"
      >
        ⚠️ Reportar erro
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0 h-full overflow-hidden relative">
      <style>
        {`
          @media print {
            @page {
              margin: 1.5cm;
              size: auto;
            }
            html, body, #root, [class*="h-screen"], [class*="overflow-hidden"] {
              height: auto !important;
              overflow: visible !important;
              display: block !important;
            }
            body {
              background: white !important;
              color: black !important;
            }
            .no-print, header, footer, .no-print * {
              display: none !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .chord-only {
              color: ${CIFRA_ORANGE} !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .chords-font:not(.chord-only) {
              color: black !important;
            }
            .print-container {
              overflow: visible !important;
              height: auto !important;
              position: static !important;
              display: block !important;
              width: 100% !important;
              max-width: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .print-page-break {
              page-break-inside: avoid;
              break-inside: avoid;
              display: block;
              width: 100%;
              margin-bottom: 0.5rem;
            }
            .print-spacer {
              height: 0.5rem !important;
            }
            /* Garantir que o título e metadados apareçam no topo da primeira página */
            .print-header {
              display: block !important;
              margin-bottom: 1rem;
              border-bottom: 2px solid #eee;
              padding-bottom: 0.5rem;
            }
            .print-watermark {
              display: none;
            }
            .print-security-mark {
              display: none;
            }
            @media print {
              .print-watermark {
                display: block !important;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-45deg);
                font-size: 80px;
                font-weight: 900;
                color: rgba(0,0,0,0.03) !important;
                white-space: nowrap;
                pointer-events: none;
                z-index: -1;
                text-transform: uppercase;
              }
              .print-security-mark {
                display: block !important;
                position: fixed;
                bottom: 0.5cm;
                right: 0.5cm;
                font-size: 7px;
                color: rgba(0,0,0,0.3) !important;
                pointer-events: none;
                z-index: 9999;
                text-transform: uppercase;
                letter-spacing: 0.1em;
              }
            }
            @keyframes spin-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .animate-spin-slow {
              animation: spin-slow 8s linear infinite;
            }
          }
        `}
      </style>
      {/* Player de Vídeo Flutuante e Arrastável */}
      <AnimatePresence>
        {activeMiniPlayer && (
            <motion.div 
              key="floating-player"
              drag
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              dragElastic={0}
              initial={{ opacity: 0, scale: 0.9, y: playerPos.y + 20 }}
              animate={{ opacity: 1, scale: 1, y: playerPos.y }}
              exit={{ opacity: 0, scale: 0.9, y: playerPos.y + 20 }}
              className={`fixed z-[1500] transition-shadow duration-300 no-print touch-none shadow-2xl ${isMinimized ? 'w-48' : 'w-64 md:w-72 max-w-[calc(100vw-40px)]'}`}
              style={{ 
                left: playerPos.x,
                pointerEvents: 'auto'
              }}
            >
          <div className={`bg-slate-900 overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl ${isMinimized ? 'rounded-2xl' : 'rounded-[2rem]'}`}>
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="flex items-center justify-between px-4 py-3 bg-slate-800/80 backdrop-blur-sm cursor-grab active:cursor-grabbing"
            >
               <div className="flex items-center gap-2 overflow-hidden">
                 <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                 <span className="text-[9px] font-black text-white uppercase tracking-widest truncate">
                    {isMinimized ? hymn.title : (activeMiniPlayer === 'guitar' ? 'Violão' : 'Piano')}
                 </span>
               </div>
               <div className="flex items-center gap-1">
                 <button 
                   onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                   className="text-white hover:text-orange-500 transition-colors p-1"
                   title={isMinimized ? "Aumentar" : "Minimizar"}
                 >
                   {isMinimized ? (
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                   ) : (
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4"/></svg>
                   )}
                 </button>
                 <button onClick={() => { setActiveMiniPlayer(null); setIsMinimized(false); }} className="text-white hover:text-red-500 transition-colors p-1">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                 </button>
                </div>
              </div>
              
              <div className={`transition-all duration-300 relative overflow-hidden ${isMinimized ? 'h-16' : 'aspect-[9/16] w-full flex items-center justify-center bg-black'}`}>
                {/* Modo Minimizado (Player de Áudio Visual) */}
                {isMinimized && (
                  <div className="absolute inset-0 bg-slate-900 flex items-center gap-3 px-4 z-10 animate-in fade-in duration-300">
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center animate-spin-slow shadow-lg flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-black text-white uppercase tracking-widest truncate leading-tight">Tocando Aula</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase truncate leading-tight">Somente Áudio</p>
                    </div>
                  </div>
                )}

                {/* Container do Vídeo (Sempre no DOM para não parar o áudio) */}
                <div className={`w-full h-full bg-black relative flex items-center justify-center ${isMinimized ? 'opacity-0 h-0 pointer-events-none' : 'opacity-100'}`}>
                  {mediaInfo.url ? (
                    mediaInfo.type === 'video' ? (
                      <video key={mediaInfo.url} src={mediaInfo.url} controls className="w-full h-full object-cover" autoPlay />
                    ) : (
                      <div className={`w-full h-full relative overflow-hidden flex items-center justify-center ${mediaInfo.type === 'tiktok' ? 'bg-black' : ''}`}>
                        <iframe 
                          key={mediaInfo.url}
                          src={mediaInfo.url} 
                          className={`w-full h-full border-0 absolute inset-0 ${mediaInfo.type === 'tiktok' ? 'scale-[1.05] top-[0%]' : ''}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
                          allowFullScreen
                          title="Video Player"
                          referrerPolicy="strict-origin-when-cross-origin"
                          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
                          style={{ overflow: 'hidden' }}
                        />
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                       <p className="text-[10px] text-slate-500 font-bold uppercase">Vídeo indisponível para este instrumento</p>
                    </div>
                  )}
                </div>
              </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Container de Rolagem unificado: Título + Letra rolam juntos */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleManualScroll}
        className="flex-1 overflow-y-auto pr-2 custom-scrollbar print:overflow-visible print-container"
        style={{ scrollBehavior: scrollSpeed > 0 ? 'auto' : 'smooth' }}
      >
        <div className="p-4 md:p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
          {/* Cabeçalho rola junto com a letra */}
          <div className="mb-8 pb-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start animate-in fade-in duration-700 print:border-slate-200 print-header print:mb-4 print:pb-4">
             <div className="flex-1">
                <h1 className="text-3xl font-black mb-1 print:text-2xl">{hymn.title}</h1>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-4 leading-relaxed print:text-slate-600 print:mb-2">{hymn.artist}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-slate-600">TOM:</span>
                  <span className="font-black text-sm" style={{ color: CIFRA_ORANGE }}>{currentKeyDisplay}</span>
                </div>
             </div>
            <div className="flex items-center gap-4 no-print">
              {!showSidebar && (
                <button 
                  onClick={() => setShowSidebar(true)}
                  className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                  Ferramentas
                </button>
              )}
              <div className="text-right">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">ORIGINAL</span>
                <span className="text-slate-400 font-black text-lg">{hymn.original_key}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col print:block">
            {renderedBlocks}
          </div>
          
          <div className="h-[70vh] no-print" />
        </div>

        {/* Security Watermark for Print */}
        {!isPro && (
          <div className="print-watermark">
            Como Tocar Hinos
          </div>
        )}
        <div className="print-security-mark">
          © Tico Rodrigues - Como Tocar Hinos - Cifra Protegida
        </div>
      </div>

      {showSidebar && (
        <div className="hidden lg:block w-80 flex-none overflow-y-auto pr-2 no-scrollbar pb-12 animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Ferramentas</h2>
            <button 
              onClick={() => setShowSidebar(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
              title="Ocultar ferramentas"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <SidebarContent />
        </div>
      )}

      <BibleModal isOpen={showBible} onClose={() => setShowBible(false)} isDark={isDark} />

      {/* Report Error Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
          <div className={`relative w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <span className="text-red-500">⚠️</span> Reportar Erro
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Viu algum erro? Envie uma mensagem no WhatsApp avisando sobre algum erro, tais como: Cifra no lugar errado, refrão em texto normal ou sem repetição, erro gramatical, letra incompleta, ferramentas com bug, etc. Ajude-nos a deixar o site cada vez melhor.
            </p>
            
            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sua Mensagem</label>
              <textarea 
                value={reportMessage}
                onChange={(e) => setReportMessage(e.target.value)}
                placeholder="Descreva o erro aqui..."
                className={`w-full h-32 p-4 rounded-2xl border-2 outline-none transition-all resize-none text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-red-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-red-500'}`}
              />
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  const text = encodeURIComponent(`*Reporte de Erro - ${hymn.title}*\n\n${reportMessage}`);
                  window.open(`https://api.whatsapp.com/send?phone=5574999446428&text=${text}`, '_blank');
                  setShowReportModal(false);
                  setReportMessage('');
                }}
                disabled={!reportMessage.trim()}
                className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                ENVIAR NO WHATSAPP
              </button>
              <button 
                onClick={() => setShowReportModal(false)}
                className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest opacity-40 hover:opacity-100 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Trigger */}
      <button 
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed bottom-24 right-6 w-16 h-16 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full shadow-2xl flex items-center justify-center z-[50] border-4 border-white dark:border-slate-900"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
      </button>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[1000] flex flex-col justify-end no-print">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className={`relative w-full max-h-[85vh] rounded-t-[3rem] p-8 overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-full duration-500 ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-8" />
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Ferramentas</h2>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChordSheet;
