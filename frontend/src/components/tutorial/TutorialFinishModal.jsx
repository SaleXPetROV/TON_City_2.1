import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useTutorial } from '@/context/TutorialContext';
import { getUiText } from '@/lib/tutorialTranslations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
export function TutorialFinishConfirm() {
  const { language } = useLanguage();
  const lang = language || 'ru';
  const { showFinishConfirm, setShowFinishConfirm, finish, loading } = useTutorial();
  const T = (k) => getUiText(lang, k);

  return (
    <Dialog open={showFinishConfirm} onOpenChange={(o) => !o && setShowFinishConfirm(false)}>
      <DialogContent
        className="bg-[#14162a] border border-orange-500/40 text-white p-0 overflow-hidden w-[94vw] max-w-md !rounded-2xl"
        data-testid="tutorial-finish-confirm-modal"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden asChild><DialogTitle>{T('finish_confirm_title')}</DialogTitle></VisuallyHidden>
        <VisuallyHidden asChild><DialogDescription>{T('finish_confirm_message')}</DialogDescription></VisuallyHidden>
        <div className="p-5 sm:p-6 bg-gradient-to-br from-orange-500/10 to-red-500/5 border-b border-orange-500/20 flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
          </div>
          <h2 className="text-base sm:text-lg font-bold leading-tight break-words">{T('finish_confirm_title')}</h2>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm text-text-muted break-words">{T('finish_confirm_message')}</p>
        </div>
        <div className="p-4 sm:p-5 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 bg-void/40">
          <Button variant="ghost" onClick={() => setShowFinishConfirm(false)} className="text-text-muted hover:text-white w-full sm:w-auto" data-testid="tutorial-finish-cancel-btn">
            {T('finish_confirm_no')}
          </Button>
          <Button onClick={finish} disabled={loading} className="bg-orange-500 text-white hover:bg-orange-600 font-bold w-full sm:w-auto" data-testid="tutorial-finish-confirm-btn">
            {T('finish_confirm_yes')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TutorialCompletedModal() {
  const { language } = useLanguage();
  const lang = language || 'ru';
  const { showCompletedModal, setShowCompletedModal } = useTutorial();
  const T = (k) => getUiText(lang, k);

  return (
    <Dialog open={showCompletedModal} onOpenChange={(o) => !o && setShowCompletedModal(false)}>
      <DialogContent
        className="bg-[#14162a] border border-green-500/40 text-white p-0 overflow-hidden w-[94vw] max-w-md !rounded-2xl"
        data-testid="tutorial-completed-modal"
        hideCloseButton
      >
        <VisuallyHidden asChild><DialogTitle>{T('finish_done_title')}</DialogTitle></VisuallyHidden>
        <VisuallyHidden asChild><DialogDescription>{T('finish_done_message')}</DialogDescription></VisuallyHidden>
        <div className="p-6 sm:p-8 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4 sm:mb-6">
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-3 break-words">{T('finish_done_title')}</h2>
          <p className="text-sm text-text-muted break-words">{T('finish_done_message')}</p>
        </div>
        <div className="p-4 sm:p-5 border-t border-white/10 flex justify-center bg-void/40">
          <Button
            onClick={() => {
              setShowCompletedModal(false);
              // After tutorial completion — send user to Home and hard-refresh
              // so every page picks up the rolled-back state (balance, listings,
              // businesses) from the server without any stale in-memory data.
              try {
                window.location.assign('/');
              } catch (e) { /* noop */ }
            }}
            className="bg-green-500 text-white hover:bg-green-600 font-bold px-6 sm:px-8 w-full sm:w-auto"
            data-testid="tutorial-completed-close-btn"
          >
            {T('got_it')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default { TutorialFinishConfirm, TutorialCompletedModal };
