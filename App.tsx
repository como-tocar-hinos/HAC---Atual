
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;
import { Hymn, Level, ViewState, InstrumentModality } from './types';
import ChordSheet from './components/ChordSheet';
import VideoTutorials from './components/VideoTutorials';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { getEmbedUrl } from './utils/musicUtils';
import { 
  Search, 
  Menu, 
  X, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Moon, 
  Sun, 
  User as UserIcon, 
  LogOut, 
  History, 
  Star, 
  Settings, 
  Crown,
  CreditCard,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PricingModal } from './src/components/PricingModal';

// --- CONFIGURAÇÃO STRIPE ---
const STRIPE_CONFIG = {
  CHECKOUT_MONTHLY: "https://buy.stripe.com/aFaeVd2mR0bf75tbRJ9ws01", 
  CHECKOUT_YEARLY: "https://buy.stripe.com/exemplo_anual_promocional",   
  CUSTOMER_PORTAL: "https://billing.stripe.com/p/login/fZuaEX7Hbf69fBZ8Fx9ws00", 
  MEMBER_AREA_URL: "https://sua-plataforma-de-membros.com", 
};

type ViewMode = 'home' | 'hymn-detail' | 'member-area' | 'subscription';
type FilterOption = 'alphabetical' | 'recent' | 'withVideos';

const WHATSAPP_SUPORTE = "https://api.whatsapp.com/send?phone=5574999446428";
const FREE_LIMIT = 20;
const CIFRA_ORANGE = '#ff6b00';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [view, setView] = useState<ViewMode>('home');
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [selectedHymn, setSelectedHymn] = useState<Hymn | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-clear messages
  useEffect(() => {
    if (errorMsg || successMsg) {
      const timer = setTimeout(() => {
        setErrorMsg(null);
        setSuccessMsg(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg, successMsg]);
  const [filterBy, setFilterBy] = useState<FilterOption>('alphabetical');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAccount, setShowAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Estados do Player Global
  const [currentHymnIndex, setCurrentHymnIndex] = useState<number | null>(null);
  const [activeModality, setActiveModality] = useState<InstrumentModality>('guitar');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPro, setIsPro] = useState(false);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('is_guest_mode') === 'true');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setIsGuest(false);
        localStorage.removeItem('is_guest_mode');
        checkProStatus(currentUser);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setIsGuest(false);
        localStorage.removeItem('is_guest_mode');
        checkProStatus(currentUser);
      } else {
        setIsPro(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user || isGuest) fetchLevels();
  }, [user, isGuest]);

  useEffect(() => {
    if (selectedLevelId && view === 'home') fetchHymns();
  }, [selectedLevelId, filterBy, view]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlayRequest = async () => {
      try {
        if (isPlaying) {
          if (video.paused) await video.play();
        } else {
          if (!video.paused) video.pause();
        }
      } catch (err) {
        setIsPlaying(false);
      }
    };

    handlePlayRequest();
  }, [isPlaying, currentHymnIndex, activeModality]);

  useEffect(() => {
    if (!user) return;

    // Monitorar mudanças em tempo real no perfil do usuário
    const channel = supabase
      .channel(`profile_sync_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            setIsPro(newData.is_pro);
            setStripeCustomerId(newData.stripe_customer_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkProStatus = async (currentUser: User) => {
    try {
      console.log('Verificando status PRO para:', currentUser.email);
      let { data, error } = await supabase.from('profiles').select('is_pro, stripe_customer_id').eq('id', currentUser.id).single();
      
      if (error) {
        console.error('Erro na consulta Supabase (profiles):', error);
        if (error.code === 'PGRST116') {
          console.log('Perfil não encontrado, tentando criar...');
          const { data: newData, error: insertError } = await supabase.from('profiles').insert({ id: currentUser.id, is_pro: false }).select().single();
          if (insertError) {
             console.error('Erro ao auto-criar perfil:', insertError);
             setErrorMsg('Erro ao criar perfil no banco. Verifique as políticas RLS.');
          } else if (newData) {
            setIsPro(newData.is_pro);
            setStripeCustomerId(newData.stripe_customer_id);
          }
          return;
        }
        setErrorMsg('Erro ao ler seu nível de acesso. Verifique as políticas RLS no Supabase.');
      }

      if (data) {
        console.log('Dados do Perfil recebidos:', data);
        setIsPro(Boolean(data.is_pro));
        setStripeCustomerId(data.stripe_customer_id);
      }
    } catch (e) {
      console.error('Erro inesperado ao verificar status PRO:', e);
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      setShowAccount(true);
      return;
    }
    
    setCheckoutLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          priceId: import.meta.env.VITE_STRIPE_PRICE_ID 
        }),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Servidor backend não encontrado. Verifique se o backend está rodando no mesmo domínio.');
        }
        throw new Error('Erro ao processar o checkout no servidor.');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMsg('Erro ao iniciar checkout. Tente novamente.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    if (!stripeCustomerId) return;
    
    setCheckoutLoading(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: stripeCustomerId }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const resetGuestMode = () => {
    localStorage.removeItem('is_guest_mode');
    setIsGuest(false);
    setShowAccount(false);
    setView('home');
  };

  const fetchLevels = async () => {
    setLoading(true);
    try {
      const { data: levelsData } = await supabase.from('levels').select('*');
      const { data: hymnsCountData } = await supabase.from('hymns').select('level_id');
      const counts: Record<string, number> = (hymnsCountData || []).reduce((acc: any, curr: any) => {
        acc[curr.level_id] = (acc[curr.level_id] || 0) + 1;
        return acc;
      }, {});
      setLevels((levelsData || []).map(l => ({ ...l, hymnCount: counts[l.id] || 0 })));
    } catch (e) {
      setErrorMsg("Erro ao carregar categorias.");
    }
    setLoading(false);
  };

  const fetchHymns = async () => {
    setLoading(true);
    let query = supabase.from('hymns').select('*').eq('level_id', selectedLevelId);
    if (filterBy === 'recent') query = query.order('created_at', { ascending: false });
    else query = query.order('title', { ascending: true });
    const { data } = await query;
    setHymns(data || []);
    setLoading(false);
  };

  const filteredHymns = useMemo(() => {
    let result = hymns.filter(h => 
      h.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      h.artist.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filterBy === 'withVideos') result = result.filter(h => h.video_url_guitar || h.video_url_piano);
    return result;
  }, [hymns, searchTerm, filterBy]);

  const isHymnFree = (hymnId: string) => {
    const originalIndex = hymns.findIndex(h => h.id === hymnId);
    return originalIndex >= 0 && originalIndex < FREE_LIMIT;
  };

  const currentHymn = currentHymnIndex !== null ? filteredHymns[currentHymnIndex] : null;

  const rawUrl = useMemo(() => {
    if (!currentHymn) return null;
    return activeModality === 'guitar' ? currentHymn.video_url_guitar : currentHymn.video_url_piano;
  }, [currentHymn, activeModality]);

  const mediaInfo = useMemo(() => getEmbedUrl(rawUrl || ''), [rawUrl]);

  const nextHymn = () => {
    if (filteredHymns.length === 0) return;
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * filteredHymns.length);
      if (nextIndex === currentHymnIndex && filteredHymns.length > 1) nextIndex = (nextIndex + 1) % filteredHymns.length;
    } else {
      nextIndex = (currentHymnIndex === null ? 0 : (currentHymnIndex + 1) % filteredHymns.length);
    }
    playHymn(nextIndex);
  };

  const prevHymn = () => {
    if (filteredHymns.length === 0) return;
    const prevIndex = (currentHymnIndex === null || currentHymnIndex === 0 ? filteredHymns.length - 1 : currentHymnIndex - 1);
    playHymn(prevIndex);
  };

  const playHymn = (index: number, modality?: InstrumentModality) => {
    const hymn = filteredHymns[index];
    if (!hymn) return;
    if (!isPro && !isHymnFree(hymn.id)) {
      setView('home');
      setSelectedLevelId(null);
      return;
    }
    if (modality) setActiveModality(modality);
    setCurrentHymnIndex(index);
    setIsPlaying(true);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) setSuccessMsg("Conta criada!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectHymn = (hymn: Hymn) => {
    if (!isPro && !isHymnFree(hymn.id)) {
      setView('home');
      setSelectedLevelId(null);
      return;
    }
    setSelectedHymn(hymn);
    setView('hymn-detail');
  };

  if (!user && !isGuest && !authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl border transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-center mb-10">
            <div className="w-16 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg mx-auto mb-6">HA</div>
            <h1 className="text-3xl font-black mb-2">{isSignUp ? 'Criar Conta' : 'Hinário Adventista Cifrado'}</h1>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
             <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full px-5 py-3.5 rounded-2xl border outline-none font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} required />
             <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full px-5 py-3.5 rounded-2xl border outline-none font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} required />
             <button type="submit" disabled={authLoading} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg uppercase tracking-wider"> {authLoading ? '...' : isSignUp ? 'CADASTRAR' : 'ENTRAR'} </button>
             <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-xs font-bold text-slate-500"> {isSignUp ? 'JÁ TENHO CONTA (LOGIN)' : 'QUERO ME CADASTRAR'} </button>
             <button type="button" onClick={() => { localStorage.setItem('is_guest_mode', 'true'); setIsGuest(true); }} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-2xl font-black text-xs">EXPLORAR COMO CONVIDADO</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`border-b flex-none z-50 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => { setView('home'); setSelectedLevelId(null); setSelectedHymn(null); setShowAccount(false); }} className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-8 bg-red-600 rounded-lg flex-none flex items-center justify-center text-white text-sm font-black shadow-lg">HA</div>
            <span className="text-lg font-bold truncate">Hinário Adventista Cifrado</span>
          </button>
          <div className="flex items-center gap-3 flex-none">
            {isPro && <span className="hidden xs:block px-3 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full shadow-sm animate-pulse">PRO</span>}
            <button onClick={() => setShowAccount(true)} className={`p-2.5 rounded-xl border transition-all ${isGuest ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-600' : 'dark:border-slate-800 text-slate-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">{isDarkMode ? '☀️' : '🌙'}</button>
            <span className="text-[9px] text-gray-400 font-mono opacity-40 ml-1">v1.2.6</span>
          </div>
        </div>
      </header>

      <main className={`flex-1 overflow-y-auto ${currentHymn ? 'pb-44 md:pb-36' : 'pb-8'}`}>
        <div className={`max-w-7xl mx-auto px-4 w-full h-full py-8`}>
          
          {/* Alertas de Mensagens */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 bg-red-500 text-white rounded-2xl shadow-lg flex items-center justify-between font-bold"
              >
                <div className="flex items-center gap-3">
                  <X className="w-5 h-5" onClick={() => setErrorMsg(null)} />
                  <span>{errorMsg}</span>
                </div>
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 bg-green-500 text-white rounded-2xl shadow-lg flex items-center justify-between font-bold"
              >
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5" onClick={() => setSuccessMsg(null)} />
                  <span>{successMsg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VIEW: HOME */}
          {view === 'home' && !selectedLevelId && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {!isPro && (
                <div className={`mb-12 p-8 md:p-12 rounded-[3.5rem] border-4 border-amber-500 shadow-2xl relative overflow-hidden transition-all group ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                   <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all duration-700"></div>
                   <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                      <div className="flex-1 text-center md:text-left">
                         <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
                            <span className="px-4 py-1.5 bg-amber-500 text-white text-[10px] font-black rounded-full shadow-lg animate-pulse uppercase tracking-widest">OFERTA ESPECIAL</span>
                         </div>
                         <h2 className="text-4xl md:text-5xl font-black mb-4 leading-tight">Todos os hinos por <span className="text-amber-500">R$ 9,90</span></h2>
                         <p className="text-slate-500 font-medium text-base md:text-lg leading-relaxed max-w-xl">
                            Acesse centenas de hinos cifrados em 3 níveis diferentes por apenas R$ 9,90/mês
                         </p>
                      </div>
                      <div className="flex-none flex flex-col items-center gap-4">
                         <button onClick={() => setShowPricing(true)} disabled={checkoutLoading} className={`px-12 py-6 bg-amber-500 text-white rounded-[2.5rem] font-black text-lg uppercase tracking-widest shadow-2xl shadow-amber-500/40 hover:bg-amber-600 transition-all active:scale-95 flex items-center gap-3 ${checkoutLoading ? 'opacity-70' : ''}`}>
                            {checkoutLoading ? 'PROCESSANDO...' : 'ASSINAR AGORA 💎'}
                         </button>
                      </div>
                   </div>
                </div>
              )}
              
              <h2 className="text-2xl font-black mb-8 uppercase tracking-widest text-slate-400 text-sm">Níveis de Dificuldade</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {levels.map(level => (
                  <button key={level.id} onClick={() => setSelectedLevelId(level.id)} className={`p-8 rounded-[2.5rem] border transition-all text-left group ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 hover:shadow-2xl'}`}>
                    <div className={`w-14 h-14 ${level.color || 'bg-red-600'} rounded-2xl flex items-center justify-center text-white text-2xl font-black mb-6 shadow-lg`}>{level.name[0]}</div>
                    <h3 className="text-2xl font-black mb-2">{level.name}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{level.description}</p>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{level.hymnCount || 0} Hinos Disponíveis</div>
                  </button>
                ))}
              </div>

              {/* Como Tocar Hinos Header */}
              <div className="mb-12 text-center py-6">
                <span className={`text-4xl md:text-5xl font-black tracking-tighter transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>COMO<span className="text-red-600">TOCAR</span>HINOS</span>
              </div>

              {/* Seção de Tutorias em Vídeo - POSIÇÃO SOLICITADA */}
              <div className="mb-12">
                <VideoTutorials isDarkMode={isDarkMode} />
              </div>

              {/* Aulas Particulares Section */}
              <div className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col md:flex-row items-center gap-8 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-blue-50 border-blue-100'}`}>
                <div className="w-20 h-20 bg-blue-600 rounded-3xl flex-none flex items-center justify-center text-white text-4xl shadow-xl">🎓</div>
                <div className="flex-1 text-center md:text-left min-w-0">
                  <h3 className="text-2xl font-black mb-3">Aulas Particulares</h3>
                  <p className={`text-lg font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Está com dificuldade? Faça aulas particulares e acelere seu aprendizado.</p>
                </div>
                <a href={WHATSAPP_SUPORTE} target="_blank" rel="noopener noreferrer" className="px-10 py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[1.8rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex-none">MEU WHATSAPP</a>
              </div>
            </div>
          )}
          
          {/* VIEW: LISTA HINOS */}
          {view === 'home' && selectedLevelId && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="flex flex-col gap-6 mb-8">
                  <button onClick={() => setSelectedLevelId(null)} className="text-slate-400 hover:text-red-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors">← Voltar para Níveis</button>
                  <div className="flex flex-col lg:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                      <input type="text" placeholder="Buscar por título ou número..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-red-600' : 'bg-white border-slate-100 text-slate-900 focus:border-red-600'}`} />
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <div className="flex gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                      <button onClick={() => setFilterBy('alphabetical')} className={`flex-1 lg:w-28 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterBy === 'alphabetical' ? 'bg-red-600 text-white shadow-lg' : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>A-Z</button>
                      <button onClick={() => setFilterBy('recent')} className={`flex-1 lg:w-28 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterBy === 'recent' ? 'bg-red-600 text-white shadow-lg' : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>Recentes</button>
                      <button onClick={() => setFilterBy('withVideos')} className={`flex-1 lg:w-32 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterBy === 'withVideos' ? 'bg-red-600 text-white shadow-lg' : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>Com Vídeos</button>
                    </div>
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {filteredHymns.map((hymn, idx) => {
                    const isFree = isHymnFree(hymn.id);
                    const canAccess = isPro || isFree;
                    const isActiveInPlayer = currentHymn?.id === hymn.id;
                    const hasVideos = hymn.video_url_guitar || hymn.video_url_piano;
                    return (
                      <div key={hymn.id} className={`p-6 rounded-3xl border-2 flex items-center justify-between gap-4 transition-all group ${isActiveInPlayer ? 'border-[#ff6b00] bg-orange-500/5' : isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 hover:border-red-600/20'} ${!canAccess ? 'opacity-60 grayscale' : 'cursor-pointer'}`} onClick={() => handleSelectHymn(hymn)}>
                         <div className="flex-1 min-w-0">
                            <h4 className={`text-base md:text-lg font-bold truncate`} style={{ color: isActiveInPlayer ? CIFRA_ORANGE : 'inherit' }}>{hymn.title}</h4>
                            <p className={`text-slate-400 text-[10px] md:text-xs leading-tight break-words mb-1`}>{hymn.artist}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`font-bold text-[9px] ${isFree ? 'text-emerald-500' : 'text-amber-500'}`}>{isFree ? 'Grátis' : 'Premium'}</span>
                              {hasVideos && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-black bg-orange-500/10 text-[#ff6b00] border border-orange-500/20 uppercase">VÍDEO DISPONÍVEL</span>}
                            </div>
                         </div>
                         <div className="flex-none">
                            <div className="p-2 text-slate-300 group-hover:text-red-600 transition-colors">
                              {canAccess ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg> : '💎'}
                            </div>
                         </div>
                      </div>
                    );
                  })}
                  {filteredHymns.length === 0 && <div className="text-center py-20 opacity-40"><p className="text-sm font-black uppercase tracking-widest">Nenhum hino encontrado.</p></div>}
               </div>
            </div>
          )}

          {view === 'hymn-detail' && selectedHymn && (
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
               <button onClick={() => setView('home')} className="mb-4 text-slate-400 hover:text-red-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors">← Voltar</button>
               <ChordSheet hymn={selectedHymn} isPro={isPro} userId={user?.id} />
            </div>
          )}

          <footer className="mt-16 pb-8 text-center no-print">
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Desenvolvido por Ministério Música Celeste</p>
          </footer>
        </div>
      </main>

      {/* PLAYER GLOBAL */}
      {currentHymn && (
        <div className={`fixed bottom-0 left-0 right-0 z-[1000] border-t-2 no-print transition-all ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-100'}`}>
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center gap-4 md:justify-between">
            <div className="flex items-center gap-4 flex-1 w-full min-w-0">
            <div className="w-20 md:w-32 aspect-video bg-black rounded-xl overflow-hidden shadow-2xl flex-none border-2 relative" style={{ borderColor: CIFRA_ORANGE }}>
                 {mediaInfo.type === 'youtube' || mediaInfo.type === 'tiktok' || mediaInfo.type === 'facebook' || mediaInfo.url.includes('drive.google.com') ? (
                   <iframe 
                      key={`global-vid-${currentHymn.id}`}
                      src={mediaInfo.url} 
                      className="w-full h-full border-0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
                      allowFullScreen 
                      title="Global Video Player"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
                      style={{ overflow: 'hidden' }}
                   />
                 ) : mediaInfo.type === 'video' ? (
                    <video ref={videoRef} key={`global-vid-${currentHymn.id}-${activeModality}`} src={mediaInfo.url} className="w-full h-full object-cover" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={nextHymn} playsInline />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center p-2 text-center">
                     <span className="text-[8px] font-bold text-slate-500 uppercase">Aguardando mídia...</span>
                   </div>
                 )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold truncate text-sm">{currentHymn.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase text-white ${activeModality === 'guitar' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    {activeModality === 'guitar' ? 'Violão' : 'Piano'}
                  </span>
                  {(mediaInfo.type === 'video' || mediaInfo.type === 'tiktok' || mediaInfo.type === 'facebook' || mediaInfo.type === 'none') && isPlaying && <div className="flex gap-0.5"><div className="w-1 h-3 bg-red-600 animate-bounce"></div><div className="w-1 h-3 bg-red-600 animate-bounce delay-75"></div><div className="w-1 h-3 bg-red-600 animate-bounce delay-150"></div></div>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 flex-none">
              <button onClick={prevHymn} className="text-2xl hover:scale-110 active:scale-95 transition-all outline-none">⏮</button>
              <button onClick={() => setIsPlaying(!isPlaying)} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all active:scale-90 outline-none ${activeModality === 'guitar' ? 'bg-red-600' : 'bg-blue-600'}`}>
                {isPlaying ? <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg> : <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
              </button>
              <button onClick={nextHymn} className="text-2xl hover:scale-110 active:scale-95 transition-all outline-none">⏭</button>
            </div>
            <div className="hidden lg:flex items-center gap-2 flex-none">
               <button onClick={() => setActiveModality('guitar')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${activeModality === 'guitar' ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>VIOLÃO</button>
               <button onClick={() => setActiveModality('piano')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${activeModality === 'piano' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>PIANO</button>
            </div>
          </div>
        </div>
      )}

      {showAccount && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAccount(false)}></div>
           <div className={`relative w-full max-w-md p-10 rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
              <button onClick={() => setShowAccount(false)} className="absolute top-6 right-6 p-2 text-slate-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
              {isGuest ? (
                <div className="text-center">
                  <h2 className="text-2xl font-black mb-2">Convidado</h2>
                  <button onClick={resetGuestMode} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">ENTRAR 🔑</button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-black mb-8 text-center">Minha Conta</h2>
                  <div className="space-y-4">
                    <p className="font-bold text-center truncate px-4">{user?.email}</p>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nível de Conta</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isPro ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}`}>
                        {isPro ? '💎 PRO / PREMIUM' : 'FREE / GRÁTIS'}
                      </span>
                    </div>

                    {isPro ? (
                      <button
                        onClick={handlePortal}
                        disabled={checkoutLoading}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase tracking-widest text-xs border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                      >
                        {checkoutLoading ? (
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>Gerenciar Assinatura 💳</>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setShowPricing(true); setShowAccount(false); }}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-2xl font-black uppercase tracking-widest text-xs border border-orange-100 dark:border-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all"
                      >
                        <Crown className="w-4 h-4" />
                        Seja PRO 💎
                      </button>
                    )}

                    <button 
                      onClick={() => {
                        if (user) {
                          checkProStatus(user);
                          setSuccessMsg('Status atualizado!');
                        }
                      }}
                      className="w-full py-4 mb-2 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      🔄 Atualizar Status
                    </button>

                    <button onClick={() => { supabase.auth.signOut(); setShowAccount(false); }} className="w-full py-4 text-red-500 font-black uppercase tracking-widest text-xs">Sair do App</button>
                  </div>
                </>
              )}
           </div>
        </div>
      )}
      <PricingModal 
        isOpen={showPricing} 
        onClose={() => setShowPricing(false)} 
        onSubscribe={handleCheckout}
        loading={checkoutLoading}
      />
    </div>
  );
};

export default App;
