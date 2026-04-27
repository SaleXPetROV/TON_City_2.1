import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useTutorial } from '@/context/TutorialContext';
import { getUiText, getStepText } from '@/lib/tutorialTranslations';
import { Button } from '@/components/ui/button';
import {
  ChevronRight, XCircle, MapPin, Target, SkipForward,
  Minus, Maximize2,
} from 'lucide-react';

/**
 * TutorialTour
 * ------------
 * - Blocks clicks on page except the spotlighted target (unless the step sets
 *   `allow_interaction`, then clicks pass through freely for user to use the
 *   real UI).
 * - Tracks the pathname at step-activation so auto-advance on `page_visit`
 *   fires only when the user actually navigates to the target route (prevents
 *   instant auto-skip of step 2 when the user is already on the home page).
 * - Shows a brief "step complete" transition between steps.
 * - Finish step primary button calls `finish()` directly (no confirm).
 *   Confirm modal is ONLY shown when the user aborts mid-tutorial.
 * - On mobile for `allow_interaction` steps the card is placed at the TOP
 *   of the screen (not bottom) and can be minimized so it never covers the
 *   element the user needs to click.
 */
export default function TutorialTour() {
  const { language } = useLanguage();
  const lang = language || 'ru';
  const {
    active, currentStep, currentStepId,
    advance, skip, fakeGrantResource, finish,
    showFinishConfirm, setShowFinishConfirm,
    showCompletedModal,
  } = useTutorial();

  const location = useLocation();
  const navigate = useNavigate();
  const [rect, setRect] = useState(null);
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  const rafRef = useRef(null);

  // --- Fade transition between steps ---
  //  1) Old card fades out (200ms)
  //  2) "Breathing" pause (1500ms) — matches the page_visit auto-advance delay
  //     so every step type has the same pacing. User sees only the page +
  //     pulsing spotlight, time to read and observe.
  //  3) New card fades in (300ms).
  // Finish-step has an extra pause (+900ms) for ceremonial feel.
  const [cardPhase, setCardPhase] = useState('idle'); // 'idle' | 'fading-out' | 'breathing' | 'fading-in'
  const prevStepIdRef = useRef(currentStepId);
  useEffect(() => {
    if (prevStepIdRef.current && currentStepId && prevStepIdRef.current !== currentStepId) {
      const isFinal = currentStepId === 'finish';
      const breathDelay = isFinal ? 2400 : 1500;
      setCardPhase('fading-out');
      const t1 = setTimeout(() => setCardPhase('breathing'), 200);
      const t2 = setTimeout(() => setCardPhase('fading-in'), 200 + breathDelay);
      const t3 = setTimeout(() => setCardPhase('idle'), 200 + breathDelay + 300);
      prevStepIdRef.current = currentStepId;
      return () => {
        clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      };
    }
    prevStepIdRef.current = currentStepId;
  }, [currentStepId]);

  // --- Minimized state on mobile (for steps where the card could overlap the UI) ---
  // Только мобильное поведение — на десктопе карточка никогда не сворачивается,
  // вместо этого она кратко прячется через `cardPhase` (fade-out → breath → fade-in)
  // когда пользователь "достиг" целевой страницы или кликнул по подсветке.
  const [minimized, setMinimized] = useState(false);
  useEffect(() => { setMinimized(false); }, [currentStepId]);

  // --- Pathname snapshot when step activates (prevents instant page_visit auto-advance) ---
  const stepStartPathRef = useRef(location.pathname);
  useEffect(() => {
    stepStartPathRef.current = location.pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepId]);

  const T = (k) => getUiText(lang, k);
  const ST = (k) => getStepText(lang, currentStepId, k);

  const isMobile = viewport.width < 640;

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // NO auto-advance on page_visit anymore.
  // When the user arrives on the target route (pathname changes to match),
  // we briefly hide the spotlight + tutorial card, let the user see the
  // page they just opened for ~1.5s, then fade the card back in with the
  // page description and a "Got it" button. They click it to advance.
  const [targetReached, setTargetReached] = useState(false);
  useEffect(() => {
    setTargetReached(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepId]);
  useEffect(() => {
    if (!active || !currentStep) return;
    if (currentStep.gate !== 'page_visit') return;
    const target = currentStep.target_route;
    if (!target) return;
    const matches = (p) => p === target
      || (target === '/island' && ['/island', '/map', '/game'].includes(p));
    if (!matches(location.pathname)) return;
    if (matches(stepStartPathRef.current)) return;
    setTargetReached(true);
    // Не сворачиваем карточку даже на мобиле: после короткой паузы
    // (`cardPhase` цикл fade-out → breath → fade-in) описание шага должно
    // быть полностью открыто, чтобы пользователь сразу видел контекст
    // страницы (особенно важно на карте).
    setMinimized(false);
  }, [location.pathname, active, currentStep, isMobile]);

  // Также: когда пользователь кликает прямо по подсвеченному target-элементу
  // (page_visit-шаг, где целевой роут совпадает с текущим — например, клик
  // по "TON CITY" на главной), прячем рамку + карточку, делаем "вдох" и
  // показываем карточку снова с описанием и кнопкой "Далее". Так шаг не
  // залипает: сначала пользователь видит чистую страницу, затем подсказку.
  useEffect(() => {
    if (!active || !currentStep || !rect) return;
    if (currentStep.gate !== 'page_visit') return;
    const onDocClick = (e) => {
      const x = e.clientX, y = e.clientY;
      if (x >= rect.left && x <= rect.left + rect.width
          && y >= rect.top && y <= rect.top + rect.height) {
        setTargetReached(true);
        setMinimized(false);
      }
    };
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('touchstart', onDocClick, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick, true);
      document.removeEventListener('touchstart', onDocClick, true);
    };
  }, [active, currentStep, rect, isMobile]);

  // Re-run the fade-out → breath → fade-in cycle when the user "reaches" the
  // target — so even on PC (where we never minimize) the card disappears for
  // ~1.5s, the user sees the page, then the description+Next-button card
  // gracefully fades back in.
  useEffect(() => {
    if (!targetReached) return;
    setCardPhase('fading-out');
    const t1 = setTimeout(() => setCardPhase('breathing'), 200);
    const t2 = setTimeout(() => setCardPhase('fading-in'), 200 + 1500);
    const t3 = setTimeout(() => setCardPhase('idle'), 200 + 1500 + 300);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, [targetReached]);

  // Auto-scroll the target into view on step activation — so when the step
  // points at a sidebar nav item or a resource card deep on the page, the
  // user can always see it without manually scrolling.
  useEffect(() => {
    if (!active || !currentStep) return;
    const sel = (isMobile && currentStep.mobile_target_selector)
      ? currentStep.mobile_target_selector
      : currentStep.target_selector;
    if (!sel) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-testid="${sel}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* noop */ }
      }
    }, 350);
    return () => clearTimeout(t);
  }, [active, currentStepId, currentStep, isMobile]);

  const computeRect = useCallback(() => {
    if (!active || !currentStep) { setRect(null); return; }
    // For create_lot we may override the target selector dynamically based on
    // the Sell modal sub-state — pick whichever effective id is live.
    const overrideSel = (() => {
      if (currentStep.id !== 'create_lot') return null;
      const modalOpen = !!document.querySelector('[data-testid="sell-resource-modal"]');
      if (!modalOpen) return null;
      const trigger = document.querySelector('[data-testid="sell-resource-select-trigger"]');
      const txt = trigger?.textContent || '';
      const picked = txt && !txt.toLowerCase().includes('выберите') && !txt.toLowerCase().includes('select');
      const ai = document.querySelector('[data-testid="sell-amount-input"]');
      const hasAmount = ai && ai.value && parseInt(ai.value, 10) > 0;
      const pi = document.querySelector('[data-testid="sell-price-input"]');
      const hasPrice = pi && pi.value && parseFloat(pi.value) > 0;
      if (!picked) return 'sell-resource-select-trigger';
      if (!hasAmount) return 'sell-amount-wrap';
      if (!hasPrice) return 'sell-price-wrap';
      return 'sell-confirm-btn';
    })();
    const sel = overrideSel || ((isMobile && currentStep.mobile_target_selector)
      ? currentStep.mobile_target_selector
      : currentStep.target_selector);
    if (!sel) { setRect(null); return; }
    const el = document.querySelector(`[data-testid="${sel}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
  }, [active, currentStep, isMobile]);

  useEffect(() => {
    if (!active) { setRect(null); return; }
    computeRect();
    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(computeRect);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    const poll = setInterval(computeRect, 300);
    const stop = setTimeout(() => clearInterval(poll), 5000);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [active, currentStepId, computeRect]);

  // --- create_lot: multi-step spotlight inside the Sell Resource modal ---
  // As the user fills the form, the highlighted element changes:
  //   1) «Sell Resource» button (before modal opens)
  //   2) Resource dropdown trigger (modal open, no resource yet)
  //   3) Amount input (resource picked, amount empty)
  //   4) «List» button (amount filled — price is optional)
  const [createLotFormHint, setCreateLotFormHint] = useState(null);
  useEffect(() => {
    if (!active || currentStepId !== 'create_lot') { setCreateLotFormHint(null); return; }
    const tick = () => {
      const modalOpen = !!document.querySelector('[data-testid="sell-resource-modal"]');
      if (!modalOpen) { setCreateLotFormHint(null); return; }
      const trigger = document.querySelector('[data-testid="sell-resource-select-trigger"]');
      const resourceChosenText = trigger?.textContent || '';
      const pickedResource = resourceChosenText && !resourceChosenText.toLowerCase().includes('выберите') && !resourceChosenText.toLowerCase().includes('select');
      const amountInput = document.querySelector('[data-testid="sell-amount-input"]');
      const hasAmount = amountInput && amountInput.value && parseInt(amountInput.value, 10) > 0;
      const priceInput = document.querySelector('[data-testid="sell-price-input"]');
      const hasPrice = priceInput && priceInput.value && parseFloat(priceInput.value) > 0;
      if (!pickedResource) setCreateLotFormHint('resource');
      else if (!hasAmount) setCreateLotFormHint('amount');
      else if (!hasPrice) setCreateLotFormHint('price');
      else setCreateLotFormHint('confirm');
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [active, currentStepId]);

  // Override target selector for create_lot based on the current sub-step
  const effectiveTargetSelector = (() => {
    if (currentStepId !== 'create_lot' || !createLotFormHint) {
      return (isMobile && currentStep?.mobile_target_selector)
        ? currentStep?.mobile_target_selector
        : currentStep?.target_selector;
    }
    if (createLotFormHint === 'resource') return 'sell-resource-select-trigger';
    if (createLotFormHint === 'amount') return 'sell-amount-wrap';
    if (createLotFormHint === 'price') return 'sell-price-wrap';
    if (createLotFormHint === 'confirm') return 'sell-confirm-btn';
    return currentStep?.target_selector;
  })();

  const createLotInstructionOverride = (() => {
    if (currentStepId !== 'create_lot' || !createLotFormHint) return null;
    if (createLotFormHint === 'resource') return 'Нажмите на поле выбора ресурса и выберите Нейро-ядро.';
    if (createLotFormHint === 'amount') return 'Введите количество, но не больше 4 единиц (оставьте хотя бы 1 на складе).';
    if (createLotFormHint === 'price') return 'Укажите цену за 1 единицу — например, 1 $CITY. Без цены лот не выставится.';
    if (createLotFormHint === 'confirm') return 'Нажмите «Выставить» — лот уйдёт в вашу подвкладку «Мои».';
    return null;
  })();

  if (!active || !currentStep) return null;
  if (showFinishConfirm || showCompletedModal) return null;

  const stepIndex = (currentStep.index || 0) + 1;
  const totalSteps = 15;
  const isClientAck = currentStep.gate === 'client_ack';
  const isOptional = currentStep.optional;
  const isServerAction = currentStep.gate === 'server_action';
  const isDbCheck = currentStep.gate === 'db_check';
  const targetRoute = currentStep.target_route;
  const isOnTargetRoute = !targetRoute || location.pathname === targetRoute
    || (targetRoute === '/island' && ['/island', '/map', '/game'].includes(location.pathname));

  const isFinalStep = currentStepId === 'finish';

  const onClickPrimary = async () => {
    // On the final step — directly finish (no confirm dialog).
    if (isFinalStep) {
      await finish();
      return;
    }
    if (currentStepId === 'fake_add_resources') {
      await fakeGrantResource({ resource_type: 'neuro_core', amount: 10 });
      return;
    }
    // Navigate to target route ONLY on page_visit steps — client_ack steps
    // just advance (e.g. go_credit highlights a button but we don't actually
    // want the user to leave the current page).
    if (currentStep?.gate === 'page_visit' && !isOnTargetRoute && targetRoute) {
      navigate(targetRoute);
      return;
    }
    // Otherwise — client_ack, or page_visit with user already on target —
    // just advance the tutorial.
    await advance(currentStepId);
  };

  const primaryLabel = () => {
    if (isFinalStep) return T('finish_button');
    if (currentStepId === 'fake_add_resources') return T('i_understand');
    if (isClientAck) return T('next_button');
    if (!isOnTargetRoute && targetRoute) return T('back_to_route');
    return T('got_it');
  };

  const primaryDisabled = (isDbCheck && currentStepId === 'create_lot')
    || (isServerAction && (currentStepId === 'fake_buy_plot' || currentStepId === 'buy_lot'));

  // Скрываем primary-кнопку, когда шаг page_visit, а пользователь ещё не
  // на целевом роуте — раньше тут была кнопка «Перейти на страницу», но по
  // запросу клиента её убрали: пользователь должен кликнуть на подсвеченный
  // sidebar-пункт сам, без дублирующей кнопки в карточке туториала.
  const hidePrimary = !isFinalStep
    && currentStep?.gate === 'page_visit'
    && !!targetRoute
    && !isOnTargetRoute;

  const allowInteraction = !!currentStep?.allow_interaction;
  const blockTargetClicks = currentStep?.block_target_clicks === true;

  // --- Click-blocking overlay ---
  const BACKDROP_COLOR = 'rgba(5, 8, 20, 0.55)';
  const BACKDROP_Z = 55;
  const SPOT_RING_Z = 60;
  const CARD_Z = 70;

  const renderOverlay = () => {
    // After the user reached the target page on a page_visit step — hide
    // the whole overlay so the user can browse the page freely.
    if (targetReached) return null;
    if (allowInteraction) {
      if (!rect) return null;
      const { top, left, width, height } = rect;
      return (
        <div
          style={{
            position: 'fixed', top, left, width, height,
            borderRadius: 14,
            boxShadow: '0 0 0 3px rgba(0, 229, 255, 0.85), 0 0 24px rgba(0, 229, 255, 0.35)',
            pointerEvents: 'none', zIndex: SPOT_RING_Z,
            transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
            animation: 'tutorial-pulse 1.6s ease-in-out infinite',
          }}
          data-testid="tutorial-spotlight"
        />
      );
    }
    if (!rect || blockTargetClicks) {
      // Full-screen backdrop (no hole) — use for welcome/finish and for
      // steps like go_credit where we highlight a nav button but don't
      // actually let the user navigate.
      return (
        <>
          <div
            style={{
              position: 'fixed', inset: 0, background: BACKDROP_COLOR,
              zIndex: BACKDROP_Z, pointerEvents: 'auto',
            }}
            data-testid="tutorial-backdrop"
            onClick={(e) => e.stopPropagation()}
          />
          {rect && (
            <div
              style={{
                position: 'fixed', top: rect.top, left: rect.left,
                width: rect.width, height: rect.height,
                borderRadius: 14,
                boxShadow: '0 0 0 3px rgba(0, 229, 255, 0.85), 0 0 24px rgba(0, 229, 255, 0.35)',
                pointerEvents: 'none', zIndex: SPOT_RING_Z,
                animation: 'tutorial-pulse 1.6s ease-in-out infinite',
              }}
              data-testid="tutorial-spotlight"
            />
          )}
        </>
      );
    }
    const { top, left, width, height } = rect;
    const right = left + width;
    const bottom = top + height;
    const p = { position: 'fixed', background: BACKDROP_COLOR, zIndex: BACKDROP_Z, pointerEvents: 'auto' };
    return (
      <>
        <div style={{ ...p, top: 0, left: 0, right: 0, height: Math.max(0, top) }} onClick={(e) => e.stopPropagation()} />
        <div style={{ ...p, top: bottom, left: 0, right: 0, bottom: 0 }} onClick={(e) => e.stopPropagation()} />
        <div style={{ ...p, top, left: 0, width: Math.max(0, left), height }} onClick={(e) => e.stopPropagation()} />
        <div style={{ ...p, top, left: right, right: 0, height }} onClick={(e) => e.stopPropagation()} />
        <div
          style={{
            position: 'fixed', top, left, width, height,
            borderRadius: 14,
            boxShadow: '0 0 0 3px rgba(0, 229, 255, 0.85), 0 0 24px rgba(0, 229, 255, 0.35)',
            pointerEvents: 'none', zIndex: SPOT_RING_Z,
            transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
            animation: 'tutorial-pulse 1.6s ease-in-out infinite',
          }}
          data-testid="tutorial-spotlight"
        />
      </>
    );
  };

  // --- Top progress ribbon (thin bar at the very top of the screen) ---
  const renderTopProgress = () => {
    const pct = Math.min(100, Math.round((stepIndex / totalSteps) * 100));
    return (
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 3,
          background: 'rgba(5, 8, 20, 0.35)', zIndex: CARD_Z + 10,
          pointerEvents: 'none',
        }}
        data-testid="tutorial-top-progress"
      >
        <div
          style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, #00e5ff, #7c5cff)',
            boxShadow: '0 0 8px rgba(0, 229, 255, 0.7)',
            transition: 'width 500ms cubic-bezier(.2,.8,.2,1)',
          }}
        />
      </div>
    );
  };

  // --- Card fade opacity driven by `cardPhase` ---
  //  idle        → fully visible
  //  fading-out  → 0
  //  breathing   → 0 (card hidden, user sees only page + spotlight)
  //  fading-in   → 1
  const cardOpacity =
    cardPhase === 'fading-out' ? 0 :
    cardPhase === 'breathing'  ? 0 :
    1;
  const cardTransition =
    cardPhase === 'fading-out' ? 'opacity 200ms ease-in' :
    cardPhase === 'fading-in'  ? 'opacity 300ms ease-out' :
    cardPhase === 'breathing'  ? 'opacity 0ms' :
    'opacity 200ms ease-out';
  // During fade-out / breathing we don't want the card to catch clicks either
  const cardPointerEvents = (cardPhase === 'breathing' || cardPhase === 'fading-out') ? 'none' : 'auto';

  // --- Card position ---
  let cardStyle = {};
  if (isMobile) {
    // Always anchor mobile card at the TOP of the screen — this way it never
    // covers the sidebar nav buttons, map cells, resource cards, or in-page
    // action buttons that the tutorial points at.
    // Use a generous maxHeight so long descriptions (e.g. «T3 = buff» step)
    // fit without the user having to scroll inside the tutorial card.
    const mobileMax = currentStepId === 'explain_t3_buff' ? '78vh' : '60vh';
    cardStyle = {
      position: 'fixed', left: 8, right: 8, top: 8,
      maxHeight: minimized ? 64 : mobileMax, zIndex: CARD_Z, overflowY: 'auto',
    };
  } else {
    const cardW = 420;
    const cardH = 360;
    const margin = 16;
    if (rect) {
      if (rect.top + rect.height + cardH + margin < viewport.height) {
        const left = Math.max(16, Math.min(rect.left, viewport.width - cardW - 16));
        cardStyle = { position: 'fixed', left, top: rect.top + rect.height + margin, width: cardW, zIndex: CARD_Z, maxHeight: `calc(100vh - ${rect.top + rect.height + margin + 16}px)`, overflowY: 'auto' };
      } else if (rect.top - cardH - margin > 0) {
        const left = Math.max(16, Math.min(rect.left, viewport.width - cardW - 16));
        cardStyle = { position: 'fixed', left, bottom: viewport.height - rect.top + margin, width: cardW, zIndex: CARD_Z, maxHeight: `calc(100vh - ${viewport.height - rect.top + margin + 16}px)`, overflowY: 'auto' };
      } else if (rect.left + rect.width + cardW + margin < viewport.width) {
        cardStyle = { position: 'fixed', left: rect.left + rect.width + margin, top: Math.max(16, Math.min(rect.top, viewport.height - cardH - 16)), width: cardW, zIndex: CARD_Z, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' };
      } else {
        cardStyle = { position: 'fixed', right: 16, bottom: 16, width: cardW, zIndex: CARD_Z, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' };
      }
    } else {
      cardStyle = { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: cardW, zIndex: CARD_Z, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' };
    }
  }

  return (
    <>
      {/* Spotlight / click blocker */}
      {renderOverlay()}

      {/* Info card */}
      <div
        data-testid="tutorial-card"
        className="bg-[#101227] border border-cyber-cyan/50 rounded-2xl shadow-2xl shadow-cyber-cyan/20 text-white overflow-hidden"
        style={{ ...cardStyle, opacity: cardOpacity, transition: cardTransition, pointerEvents: cardPointerEvents }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyber-cyan/20 flex items-center justify-center flex-shrink-0">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-cyber-cyan" />
          </div>
          <div className="flex-1 min-w-0 flex items-center">
            <h3 className="text-sm sm:text-base font-bold leading-snug break-words" data-testid="tutorial-step-title">{ST('title')}</h3>
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={() => setMinimized((m) => !m)}
              className="text-text-muted hover:text-cyber-cyan transition-colors flex-shrink-0"
              title={minimized ? 'Развернуть' : 'Свернуть'}
              data-testid="tutorial-minimize-btn"
            >
              {minimized ? <Maximize2 className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFinishConfirm(true)}
            className="text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
            title={T('finish_button')}
            data-testid="tutorial-end-btn"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {!minimized && (
          <>
            {/* Body */}
            <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3">
              <p
                className="text-xs sm:text-sm text-text-muted whitespace-pre-line break-words"
                data-testid="tutorial-step-description"
              >
                {ST('description')}
              </p>
              <div className="px-3 py-2 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-lg text-xs sm:text-sm text-white flex items-start gap-2">
                <MapPin className="w-4 h-4 text-cyber-cyan flex-shrink-0 mt-0.5" />
                <span className="break-words" data-testid="tutorial-step-instruction">
                  {createLotInstructionOverride || ST('instruction')}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              {isFinalStep ? <span /> : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFinishConfirm(true)}
                  className="text-text-muted hover:text-red-400 text-xs w-full sm:w-auto"
                  data-testid="tutorial-finish-btn"
                >
                  {T('finish_button')}
                </Button>
              )}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:flex-shrink-0">
                {isOptional && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => skip(currentStepId)}
                    className="border-white/20 text-text-muted hover:text-white text-xs w-full sm:w-auto"
                    data-testid="tutorial-skip-step-btn"
                  >
                    <SkipForward className="w-4 h-4 mr-0.5" /> {T('skip_optional')}
                  </Button>
                )}
                {!hidePrimary && (
                  <Button
                    size="sm"
                    onClick={onClickPrimary}
                    disabled={primaryDisabled}
                    className="bg-cyber-cyan text-black hover:bg-cyber-cyan/80 font-bold w-full sm:w-auto whitespace-normal break-words h-auto min-h-[36px] px-3 py-2 inline-flex items-center justify-center gap-1"
                    data-testid="tutorial-primary-action-btn"
                  >
                    <span className="break-words">{primaryLabel()}</span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top progress ribbon */}
      {renderTopProgress()}

      {/* Keyframes for pulse */}
      <style>{`
        @keyframes tutorial-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.85), 0 0 24px rgba(0, 229, 255, 0.35); }
          50%     { box-shadow: 0 0 0 5px rgba(0, 229, 255, 1),    0 0 36px rgba(0, 229, 255, 0.6); }
        }
      `}</style>
    </>
  );
}
