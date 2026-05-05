
import React, { useState } from 'react';

interface BibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

const BibleModal: React.FC<BibleModalProps> = ({ isOpen, onClose, isDark }) => {
  const [reference, setReference] = useState('');
  const [verseText, setVerseText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVerse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;

    setLoading(true);
    setError(null);
    setVerseText(null);

    try {
      // Usando a tradução Almeida (almeida) para resultados em Português
      const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=almeida`);
      if (!response.ok) throw new Error('Referência não encontrada. Tente "João 3:16" ou "Salmos 23"');
      
      const data = await response.json();
      setVerseText(data.text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 no-print">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}></div>
      <div className={`relative w-full max-w-lg p-6 md:p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex items-center justify-between mb-6 flex-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg text-xl">📖</div>
            <h2 className="text-xl font-black">Leitura Bíblica</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={fetchVerse} className="space-y-4 mb-6 flex-none">
          <div className="relative">
            <input 
              type="text" 
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: João 3:16"
              className={`w-full pl-5 pr-14 py-4 rounded-2xl border outline-none font-bold transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
            />
            <button 
              type="submit" 
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs transition-all active:scale-95"
            >
              {loading ? '...' : 'BUSCAR'}
            </button>
          </div>
        </form>

        <div className={`flex-1 overflow-y-auto p-6 rounded-3xl border transition-colors ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 py-10">
              <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">Consultando Escrituras...</span>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <p className="text-red-500 font-bold text-sm">{error}</p>
            </div>
          ) : verseText ? (
            <div className="animate-in fade-in duration-500">
              <h3 className="text-blue-500 font-black text-xs uppercase tracking-widest mb-3">{reference} (Almeida)</h3>
              <p className={`text-xl leading-relaxed font-serif ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {verseText}
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 opacity-30 py-10">
              <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              <p className="text-xs font-black uppercase">Busque um versículo para ler</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BibleModal;
