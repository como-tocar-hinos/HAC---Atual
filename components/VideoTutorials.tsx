
import React, { useState, useEffect, useMemo } from 'react';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;
import { supabase } from '../lib/supabase';
import { getEmbedUrl } from '../utils/musicUtils';

interface Lesson {
  id: string;
  title: string;
  description?: string;
  video_url: string;
}

interface Module {
  id: string;
  name: string;
  lessons: Lesson[];
}

interface LevelGroup {
  id: string;
  level: string;
  color: string;
  bgColor: string;
  modules: Module[];
}

interface VideoTutorialsProps {
  isDarkMode: boolean;
}

const VideoTutorials: React.FC<VideoTutorialsProps> = ({ isDarkMode }) => {
  const [levels, setLevels] = useState<LevelGroup[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTutorialData();
  }, []);

  const fetchTutorialData = async () => {
    setLoading(true);
    try {
      // 1. Busca Níveis
      const { data: levelsData, error: lError } = await supabase
        .from('tutorial_levels')
        .select('*')
        .order('sort_order', { ascending: true });

      if (lError) throw lError;

      // 2. Busca Módulos
      const { data: modulesData, error: mError } = await supabase
        .from('tutorial_modules')
        .select('*')
        .order('sort_order', { ascending: true });

      if (mError) throw mError;

      // 3. Busca Aulas
      const { data: lessonsData, error: leError } = await supabase
        .from('tutorial_lessons')
        .select('*')
        .order('sort_order', { ascending: true });

      if (leError) throw leError;

      // Organiza a estrutura hierárquica
      const structured: LevelGroup[] = (levelsData || []).map(lvl => ({
        id: lvl.id,
        level: lvl.name,
        color: lvl.color,
        bgColor: lvl.bg_color,
        modules: (modulesData || [])
          .filter(m => m.level_id === lvl.id)
          .map(m => ({
            id: m.id,
            name: m.name,
            lessons: (lessonsData || []).filter(le => le.module_id === m.id)
          }))
      }));

      setLevels(structured);
      
      // Seleciona a primeira aula por padrão se houver
      if (structured.length > 0 && structured[0].modules.length > 0 && structured[0].modules[0].lessons.length > 0) {
        setSelectedLesson(structured[0].modules[0].lessons[0]);
        setExpandedModules(new Set([structured[0].modules[0].id]));
      }

    } catch (err) {
      console.error("Erro ao carregar tutoriais:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (id: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedModules(newExpanded);
  };

  // Processa a mídia da aula selecionada
  const mediaInfo = useMemo(() => {
    if (!selectedLesson?.video_url) return { url: '', originalUrl: '', type: 'none' as const };
    return getEmbedUrl(selectedLesson.video_url);
  }, [selectedLesson]);

  // Helper para formatar a descrição com suporte a títulos e listas
  const renderFormattedDescription = (text: string) => {
    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return <div key={index} className="h-2" />;
      
      // Se a linha termina com ":", formatamos como um título/cabeçalho em negrito
      if (trimmedLine.endsWith(':')) {
        return (
          <div key={index} className="mt-4 first:mt-0 mb-2">
            <strong className="text-slate-800 dark:text-slate-100 font-black text-sm uppercase tracking-wide">
              {trimmedLine}
            </strong>
          </div>
        );
      }

      // Linhas comuns (hinos da lista)
      return (
        <div key={index} className="text-slate-600 dark:text-slate-400 font-medium text-sm leading-relaxed py-0.5">
          {trimmedLine}
        </div>
      );
    });
  };

  const Sidebar = () => (
    <div className="flex flex-col gap-6">
      {levels.map((group, gIdx) => (
        <div key={group.id} className="mb-4">
          {/* HIERARQUIA 1: NÍVEIS */}
          <div className={`${group.bgColor} ${group.color} px-5 py-3.5 rounded-2xl shadow-md mb-4 flex items-center justify-between`}>
            <h4 className="text-[11.5px] font-black uppercase tracking-[0.2em] text-white">
              {group.level}
            </h4>
            <div className="w-2.5 h-2.5 rounded-full bg-white/40 animate-pulse" />
          </div>

          <div className="space-y-3">
            {group.modules.map(module => (
              <div 
                key={module.id} 
                className={`rounded-2xl overflow-hidden border transition-all duration-300 ${
                  expandedModules.has(module.id) 
                    ? 'bg-slate-100/90 border-slate-300 dark:bg-slate-800/40 dark:border-slate-800 ring-1 ring-slate-200/50 dark:ring-slate-900/50' 
                    : 'bg-white border-slate-200 hover:bg-slate-50/80 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/30'
                }`}
              >
                
                {/* HIERARQUIA 2: MÓDULOS */}
                <button 
                  onClick={() => toggleModule(module.id)}
                  className={`w-full p-4 flex items-center justify-between text-left transition-all hover:text-red-650`}
                >
                  <span className={`text-sm font-bold uppercase tracking-tight transition-colors ${
                    expandedModules.has(module.id) 
                      ? 'text-red-700 dark:text-red-400' 
                      : 'text-slate-800 dark:text-slate-100'
                  }`}>
                    {module.name}
                  </span>
                  <svg className={`w-4 h-4 transition-transform duration-300 ${
                    expandedModules.has(module.id) ? 'rotate-180 text-red-600' : 'text-slate-600 dark:text-slate-400'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                {/* HIERARQUIA 3: AULAS */}
                {expandedModules.has(module.id) && (
                  <div className="px-2 pb-3 space-y-1 bg-white/50 dark:bg-transparent border-t border-slate-200 dark:border-slate-800 pt-2">
                    {module.lessons.map(lesson => (
                      <button
                        key={lesson.id}
                        onClick={() => {
                          setSelectedLesson(lesson);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full p-3 rounded-xl text-xs font-semibold text-left transition-all flex items-center gap-3 group relative ${
                          selectedLesson?.id === lesson.id 
                            ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/25 font-bold' 
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800/60 dark:hover:text-white'
                        }`}
                      >
                        {selectedLesson?.id === lesson.id && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 bg-red-600 rounded-full" />
                        )}
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-[8px] transition-colors ${
                          selectedLesson?.id === lesson.id ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-bold'
                        }`}>
                           {selectedLesson?.id === lesson.id ? '●' : '▶'}
                        </div>
                        <span className="truncate">{lesson.title}</span>
                      </button>
                    ))}
                    {module.lessons.length === 0 && (
                      <div className="p-4 text-center text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Em breve</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {group.modules.length === 0 && (
               <div className="p-4 text-center text-xs text-slate-600 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">Nenhum módulo cadastrado</div>
            )}
          </div>
        </div>
      ))}
      {!loading && levels.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm font-bold text-slate-500">Nenhum tutorial disponível</p>
        </div>
      )}
    </div>
  );

  return (
    <div id="video-tutorials" className={`p-6 md:p-10 rounded-[3.5rem] border-2 transition-all duration-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}>
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
             <span className="text-red-600">🎬</span> Tutorias em Vídeo
          </h2>
          <p className="text-slate-500 font-bold text-sm">Aprenda os acordes e acompanhamentos para uma melhor experiência musical</p>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
           <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
           CONTEÚDO DINÂMICO
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 relative">
        {/* Sidebar Desktop */}
        <div className="hidden lg:block w-80 flex-none h-[650px] overflow-y-auto no-scrollbar pr-4 border-r border-slate-100 dark:border-slate-800">
          {loading ? (
            <div className="space-y-6 animate-pulse">
               {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl" />)}
            </div>
          ) : <Sidebar />}
        </div>

        {/* Floating Menu Trigger (Mobile) */}
        <div className="lg:hidden mb-6">
           <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-full py-5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-[2rem] font-black text-xs flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
           >
             📖 {loading ? 'CARREGANDO...' : 'ESCOLHER MÓDULO E AULA'}
           </button>
        </div>

        {/* Player Section */}
        <div className="flex-1 min-w-0" key={selectedLesson?.id || 'no-lesson'}>
          {loading ? (
             <div className="aspect-video rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ) : selectedLesson ? (
            <>
              <div className={`rounded-2xl overflow-hidden bg-black shadow-2xl border-4 border-slate-200 dark:border-slate-800 mb-8 group relative transition-all duration-500 ${(
                mediaInfo.type === 'tiktok' || 
                (mediaInfo.type === 'facebook' && mediaInfo.originalUrl.includes('share/v')) || 
                mediaInfo.originalUrl.includes('instagram.com') ||
                mediaInfo.originalUrl.includes('shorts')
              ) ? 'max-w-[400px] mx-auto aspect-[9/16]' : 'aspect-video'}`}>
                {mediaInfo.type !== 'none' ? (
                  mediaInfo.type === 'youtube' || mediaInfo.type === 'tiktok' || mediaInfo.type === 'facebook' || mediaInfo.url.includes('drive.google.com') ? (
                    <iframe 
                      src={mediaInfo.url} 
                      className="w-full h-full border-0 focus:outline-none" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
                      allowFullScreen 
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="eager"
                    />
                  ) : (
                    <Player 
                      url={mediaInfo.url}
                      width="100%"
                      height="100%"
                      playing={true}
                      controls={true}
                    />
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center">
                    <p className="text-sm text-slate-500 font-bold uppercase">Mídia não suportada</p>
                  </div>
                )}
              </div>
              {mediaInfo.type === 'tiktok' && (
                <div className="mb-8 flex justify-center">
                  <a 
                    href={mediaInfo.originalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black text-xs flex items-center gap-3 shadow-lg hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                  >
                    <span>Abrir no TikTok</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  </a>
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 px-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                     <span className="px-3 py-1 bg-red-600/10 text-red-600 text-[9px] font-black rounded-full uppercase tracking-widest">
                       Aula em Foco
                     </span>
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                     <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">VÍDEO HD</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight mb-4">
                    {selectedLesson.title}
                  </h3>
                  {selectedLesson.description && (
                    <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-500 shadow-sm">
                       {renderFormattedDescription(selectedLesson.description)}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="aspect-video rounded-2xl bg-slate-50 dark:bg-slate-800/20 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
               <span className="text-4xl mb-4">📺</span>
               <p className="font-black uppercase text-xs tracking-widest">Selecione uma aula no menu</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Modal */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[2500] flex items-end no-print lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />
          <div className={`relative w-full max-h-[85vh] overflow-y-auto rounded-t-[4rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-[0_-20px_50px_rgba(0,0,0,0.3)] ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-10" />
            <div className="flex items-center justify-between mb-10">
               <div>
                  <h3 className="text-2xl font-black">Grade de Estudos</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Selecione para assistir</p>
               </div>
               <button onClick={() => setIsMobileMenuOpen(false)} className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center transition-all active:scale-90">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoTutorials;
