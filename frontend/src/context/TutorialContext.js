import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const TutorialContext = createContext(null);

export function TutorialProvider({ children, user }) {
  const [active, setActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currentStepId, setCurrentStepId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [steps, setSteps] = useState([]);
  const [state, setState] = useState({ fake_plots: [], fake_resources: {}, fake_lot_id: null });
  const [loading, setLoading] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const lastStatusRef = useRef(null);

  const getToken = () => localStorage.getItem('token');

  const refreshStatus = useCallback(async () => {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API}/tutorial/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const data = await res.json();
      setActive(!!data.active);
      setCompleted(!!data.completed);
      setCurrentStepId(data.current_step_id);
      setCurrentStep(data.current_step);
      setSteps(data.steps || []);
      setState(data.state || { fake_plots: [], fake_resources: {}, fake_lot_id: null });
      lastStatusRef.current = data;
      setStatusLoaded(true);
      return data;
    } catch (e) {
      console.warn('[tutorial] status failed', e);
      return null;
    }
  }, []);

  // Initial fetch when user is available
  useEffect(() => {
    if (user?.id) {
      refreshStatus();
    }
  }, [user?.id, refreshStatus]);

  // Auto-show start modal for fresh users (not completed, not active).
  // Source of truth: DB (`completed` / `active` fields on user). We do NOT
  // rely on sessionStorage — so that clearing `tutorial_completed` in the DB
  // (e.g. admin `reset`) immediately re-enables the welcome prompt.
  useEffect(() => {
    if (!user?.id) return;
    if (!statusLoaded) return;
    if (active || completed) return; // already in tutorial or already done
    // Small delay so the UI settles before opening
    const timer = setTimeout(() => setShowStartModal(true), 800);
    return () => clearTimeout(timer);
  }, [active, completed, user?.id, statusLoaded]);

  // Manual launcher: used by sidebar/mobile-nav/landing-page tutorial buttons.
  // ALWAYS resets the backend state first so the user replays the tutorial
  // from step 1 with a fresh snapshot (no carry-over from previous attempts).
  const launch = useCallback(async () => {
    if (active) return; // already running — tour is on screen
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API}/tutorial/reset`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        await refreshStatus();
      } catch (e) {
        console.warn('[tutorial] reset before launch failed', e);
      }
    }
    setShowStartModal(true);
  }, [active, refreshStatus]);

  // Server-side buy-lot during buy_lot step — wrapper used by TradingPage
  const buyTutorialLot = useCallback(async ({ amount = 5 } = {}) => {
    const token = getToken();
    if (!token) return { ok: false };
    const res = await fetch(`${API}/tutorial/buy-lot`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await refreshStatus();
      return { ok: true, data };
    }
    return { ok: false, error: data.detail || 'Buy lot failed' };
  }, [refreshStatus]);

  // Fetch the hidden tutorial bot lot visible only to current user
  const getSeedLot = useCallback(async () => {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API}/tutorial/seed-lot`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const d = await res.json();
      return d.lot || null;
    } catch {
      return null;
    }
  }, []);

  // Mark tutorial as completed/skipped on the backend without actually running it.
  // Used when the user presses "Skip (can start later)" on the welcome modal —
  // this persists the choice in DB so we don't prompt again on next login.
  const dismissStart = useCallback(async () => {
    const token = getToken();
    setShowStartModal(false);
    if (!token) return;
    try {
      await fetch(`${API}/tutorial/mark-skipped`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshStatus();
    } catch (e) {
      console.warn('[tutorial] mark-skipped failed', e);
    }
  }, [refreshStatus]);

  const start = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/tutorial/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShowStartModal(false);
        await refreshStatus();
      }
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const advance = useCallback(async (stepId) => {
    const token = getToken();
    if (!token) return { ok: false };
    try {
      const res = await fetch(`${API}/tutorial/advance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: stepId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await refreshStatus();
        return { ok: true, data };
      }
      return { ok: false, error: data.detail || 'Advance failed' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [refreshStatus]);

  const skip = useCallback(async (stepId) => {
    const token = getToken();
    if (!token) return { ok: false };
    const res = await fetch(`${API}/tutorial/skip`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_id: stepId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await refreshStatus();
      return { ok: true, data };
    }
    return { ok: false, error: data.detail || 'Skip failed' };
  }, [refreshStatus]);

  const fakeBuyPlot = useCallback(async ({ x, y, zone, business_icon, business_name }) => {
    const token = getToken();
    if (!token) return { ok: false };
    const res = await fetch(`${API}/tutorial/fake-buy-plot`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, zone, business_icon, business_name }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await refreshStatus();
      return { ok: true, data };
    }
    return { ok: false, error: data.detail || 'Fake buy plot failed' };
  }, [refreshStatus]);

  const fakeGrantResource = useCallback(async ({ resource_type = 'neuro_core', amount = 10 } = {}) => {
    const token = getToken();
    if (!token) return { ok: false };
    const res = await fetch(`${API}/tutorial/fake-grant-resource`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_type, amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await refreshStatus();
      return { ok: true, data };
    }
    return { ok: false, error: data.detail || 'Fake grant failed' };
  }, [refreshStatus]);

  const createTutorialLot = useCallback(async ({ resource_type = 'neuro_core', amount = 5, price_per_unit = 1.0 }) => {
    const token = getToken();
    if (!token) return { ok: false };
    const res = await fetch(`${API}/tutorial/create-lot`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_type, amount, price_per_unit }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await refreshStatus();
      return { ok: true, data };
    }
    return { ok: false, error: data.detail || 'Create tutorial lot failed' };
  }, [refreshStatus]);

  const finish = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/tutorial/finish`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setShowFinishConfirm(false);
        setShowCompletedModal(true);
        await refreshStatus();
      }
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  // Derived helpers
  const isRouteAllowed = useCallback((path) => {
    if (!active) return true;
    if (!currentStep) return true;
    const target = currentStep.target_route;
    if (!target) return true;
    // Always allow settings/auth/tutorial itself
    if (path.startsWith('/auth') || path.startsWith('/forgot-password')) return true;
    // Allow the target route
    if (target === '/island' && (path === '/map' || path === '/island' || path === '/game')) return true;
    return path === target;
  }, [active, currentStep]);

  const getAllowedRoute = useCallback(() => {
    if (!active || !currentStep) return null;
    return currentStep.target_route;
  }, [active, currentStep]);

  const value = {
    active, completed, currentStepId, currentStep, steps, state, loading,
    showStartModal, setShowStartModal,
    showFinishConfirm, setShowFinishConfirm,
    showCompletedModal, setShowCompletedModal,
    refreshStatus, start, advance, skip,
    fakeBuyPlot, fakeGrantResource, createTutorialLot, finish,
    buyTutorialLot, getSeedLot,
    isRouteAllowed, getAllowedRoute,
    launch, dismissStart,
  };

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    return {
      active: false,
      completed: false,
      currentStepId: null,
      currentStep: null,
      steps: [],
      state: { fake_plots: [], fake_resources: {}, fake_lot_id: null },
      showStartModal: false, setShowStartModal: () => {},
      showFinishConfirm: false, setShowFinishConfirm: () => {},
      showCompletedModal: false, setShowCompletedModal: () => {},
      refreshStatus: async () => {}, start: async () => {}, advance: async () => ({ ok: false }),
      skip: async () => ({ ok: false }), fakeBuyPlot: async () => ({ ok: false }),
      fakeGrantResource: async () => ({ ok: false }), createTutorialLot: async () => ({ ok: false }),
      finish: async () => {}, isRouteAllowed: () => true, getAllowedRoute: () => null,
      launch: () => {}, dismissStart: async () => {},
    };
  }
  return ctx;
}

export default TutorialContext;
