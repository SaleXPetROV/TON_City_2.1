import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useTutorial } from '@/context/TutorialContext';
import { getUiText } from '@/lib/tutorialTranslations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { GraduationCap, Play } from 'lucide-react';

export default function TutorialStartModal() {
  const { language } = useLanguage();
  const lang = language || 'ru';
  const { showStartModal, start, dismissStart, loading } = useTutorial();

  const T = (k) => getUiText(lang, k);

  return (
    <Dialog open={showStartModal}>
      <DialogContent
        className="bg-[#14162a] border border-cyber-cyan/30 text-white p-0 overflow-hidden w-[94vw] sm:w-[520px] max-w-[520px] max-h-[92vh] overflow-y-auto !rounded-2xl"
        data-testid="tutorial-start-modal"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <VisuallyHidden asChild><DialogTitle>{T('start_title')}</DialogTitle></VisuallyHidden>
        <VisuallyHidden asChild><DialogDescription>{T('start_message')}</DialogDescription></VisuallyHidden>

        {/* Header */}
        <div className="bg-gradient-to-br from-cyber-cyan/15 to-purple-500/10 p-4 sm:p-5 border-b border-cyber-cyan/20 flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-cyber-cyan/20 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6 text-cyber-cyan" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-xl font-bold leading-tight break-words hyphens-auto" style={{ wordBreak: 'break-word' }}>
              {T('start_title')}
            </h2>
            <p className="text-[11px] sm:text-xs text-text-muted mt-1">Interactive sandbox • 13 steps</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed break-words" style={{ wordBreak: 'break-word' }}>
            {T('start_message')}
          </p>
          <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-[11px] text-text-muted">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <div className="text-cyber-cyan font-bold text-sm sm:text-base">13</div>
              <div className="leading-tight">steps</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <div className="text-cyber-cyan font-bold text-sm sm:text-base">~5</div>
              <div className="leading-tight">min</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
              <div className="text-cyber-cyan font-bold text-sm sm:text-base">100%</div>
              <div className="leading-tight">reversible</div>
            </div>
          </div>
        </div>

        {/* Footer — buttons always stack vertically on narrow widths, side-by-side only on ≥sm */}
        <div className="p-3 sm:p-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 bg-void/40">
          <Button
            variant="ghost"
            onClick={() => { if (dismissStart) dismissStart(); }}
            className="text-text-muted hover:text-white text-xs sm:text-sm w-full sm:w-auto whitespace-normal break-words h-auto min-h-[40px] px-3 py-2"
            data-testid="tutorial-skip-start-btn"
          >
            {T('skip_button')}
          </Button>
          <Button
            onClick={start}
            disabled={loading}
            className="bg-cyber-cyan text-black hover:bg-cyber-cyan/80 font-bold w-full sm:w-auto whitespace-normal break-words h-auto min-h-[40px] px-3 py-2"
            data-testid="tutorial-start-btn"
          >
            <Play className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="break-words">{T('start_button')}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
