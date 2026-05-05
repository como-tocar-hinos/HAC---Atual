import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Crown, Zap, ShieldCheck, Music, Video, Star } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  loading: boolean;
}

export function PricingModal({ isOpen, onClose, onSubscribe, loading }: PricingModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-2xl">
                  <Crown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Plano PRO</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Acesso ilimitado e recursos exclusivos</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <FeatureItem icon={<Music />} text="Acesso a todas as cifras" />
                <FeatureItem icon={<Zap />} text="Ferramentas de transposição ilimitadas" />
                <FeatureItem icon={<ShieldCheck />} text="Impressão sem marca d'água" />
                <FeatureItem icon={<Video />} text="Tutoriais em vídeos" />
                <FeatureItem icon={<Star />} text="Arranjos em vídeo para violão e piano" />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-100 dark:border-slate-800">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">R$ 9,90</span>
                  <span className="text-slate-500 dark:text-slate-400">/mês</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Cancele quando quiser. Sem fidelidade.</p>
              </div>

              <button
                onClick={onSubscribe}
                disabled={loading}
                className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Assinar Agora
                  </>
                )}
              </button>
              
              <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
                Pagamento seguro processado pelo Stripe.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-orange-600 dark:text-orange-400 flex-shrink-0">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
      </div>
      <span className="text-slate-700 dark:text-slate-300 font-medium">{text}</span>
    </div>
  );
}
