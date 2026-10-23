import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { OwnerOrder, OwnerRestaurant } from '@bilhanah/contracts';
import { useToast } from '../../../components/Toast';
import { apiClient } from '../../../lib/api';
import { ordersApi } from '../../../lib/api/endpoints';
import { API_URL } from '../../../lib/config';
import { useLanguage } from '../../../lib/language';
import type { ConnectionState, OwnerRealtime } from '../../../lib/realtime/owner-realtime';
import { sessionStore } from '../../../lib/session';
import { queryKeys } from '../queries';
import { isActiveStatus, upsertOrder } from './board';
import { getAudioState, playChime, subscribeAudio, unlockAudio, type AudioState } from './chime';
import { orderNo } from './labels';

const SOUND_KEY = 'bilhanah:order-sound:v1';
/** While new orders are unseen, the sound repeats this often. */
const REPEAT_MS = 30_000;
/** The board API pages; a restaurant never has this many open orders at once. */
const BOARD_PAGE_SIZE = 100;

type LiveValue = {
  /** Ordering is part of the plan, so the board is loaded and kept live. */
  enabled: boolean;
  connection: ConnectionState;
  /** Orders that arrived since the owner last interacted with the board. */
  unseen: ReadonlySet<string>;
  markSeen: () => void;
  /** Orders waiting to be accepted (the navigation badge). */
  newCount: number;
  sound: { on: boolean; setOn: (on: boolean) => void; audio: AudioState; unlock: () => Promise<boolean> };
};

const LiveContext = createContext<LiveValue | null>(null);

export const fetchBoard = async (): Promise<OwnerOrder[]> => (await ordersApi.list({ view: 'active', pageSize: BOARD_PAGE_SIZE })).items;

export function useBoardQuery(enabled = true) {
  return useQuery({ queryKey: queryKeys.board, queryFn: fetchBoard, enabled, staleTime: 15_000 });
}

function readSoundPreference(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}

/** "(2) Orders | Bilhanah" while there are unseen orders; survives page title changes. */
function useTitleCount(count: number) {
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\)\s/, '');
      const wanted = count > 0 ? `(${count}) ${base}` : base;
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    const title = document.querySelector('title');
    if (!title || count === 0) return;
    const observer = new MutationObserver(apply);
    observer.observe(title, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [count]);
}

/**
 * Keeps the owner's board live across the whole owner shell: the Socket.IO feed,
 * the new-order alert (sound, toast, tab title) and the count for the navigation.
 */
export function OrdersLiveProvider({ restaurant, children }: { restaurant: OwnerRestaurant; children: ReactNode }) {
  const enabled = restaurant.ordering.included;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { text, number } = useLanguage();
  const board = useBoardQuery(enabled);
  const [connection, setConnection] = useState<ConnectionState>('stopped');
  const [unseen, setUnseen] = useState<ReadonlySet<string>>(() => new Set());
  const [soundOn, setSoundOnState] = useState(readSoundPreference);
  const audio = useSyncExternalStore(subscribeAudio, getAudioState, () => 'unsupported' as const);

  const latest = useRef({ soundOn, text, number, toast });
  latest.current = { soundOn, text, number, toast };

  // The live feed: events go straight into the board cache; every (re)connection refetches.
  useEffect(() => {
    if (!enabled) return;
    let realtime: OwnerRealtime | null = null;
    let cancelled = false;
    // The Socket.IO client loads on demand, outside the first bundle.
    void import('../../../lib/realtime/owner-realtime').then(({ createOwnerRealtime }) => {
      if (cancelled) return;
      realtime = createOwnerRealtime({
        url: API_URL,
        getToken: () => sessionStore.accessToken(),
        refresh: () => apiClient.refreshSession(),
        onOrderCreated: order => queryClient.setQueryData<OwnerOrder[]>(queryKeys.board, current => upsertOrder(current ?? [], order)),
        onOrderUpdated: order => {
          queryClient.setQueryData<OwnerOrder[]>(queryKeys.board, current => (current ? upsertOrder(current, order) : current));
          queryClient.setQueryData(queryKeys.order(order.id), order);
          if (!isActiveStatus(order.status)) void queryClient.invalidateQueries({ queryKey: queryKeys.orderHistoryAll });
        },
        onRestaurantUpdated: ordering => {
          queryClient.setQueryData<OwnerRestaurant>(queryKeys.restaurant, current => (current ? { ...current, ordering } : current));
        },
        onResync: () => void queryClient.invalidateQueries({ queryKey: queryKeys.board }),
        onStateChange: setConnection,
      });
      realtime.start();
    });
    return () => {
      cancelled = true;
      realtime?.stop();
    };
  }, [enabled, queryClient]);

  // New orders, however they arrived (live event or a refetch after reconnecting), alert once.
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    const orders = board.data;
    if (!orders) return;
    const placed = orders.filter(order => order.status === 'PLACED');
    if (known.current === null) {
      // The first load is not news.
      known.current = new Set(orders.map(order => order.id));
      return;
    }
    const fresh = placed.filter(order => !known.current!.has(order.id));
    for (const order of orders) known.current.add(order.id);
    setUnseen(current => {
      const stillNew = [...current].filter(id => placed.some(order => order.id === id));
      const next = new Set([...stillNew, ...fresh.map(order => order.id)]);
      return next.size === current.size && stillNew.length === current.size ? current : next;
    });
    if (fresh.length === 0) return;
    const { soundOn: sound, text: t, number: n, toast: notify } = latest.current;
    if (sound) playChime();
    notify.success(fresh.length === 1
      ? t(`طلب جديد ${orderNo(fresh[0]!.number, n)}`, `New order #${fresh[0]!.number}`)
      : t(`${n(fresh.length)} طلبات جديدة`, `${fresh.length} new orders`));
  }, [board.data]);

  // Repeat the sound while new orders are waiting to be seen.
  useEffect(() => {
    if (unseen.size === 0 || !soundOn) return;
    const timer = window.setInterval(() => playChime(), REPEAT_MS);
    return () => window.clearInterval(timer);
  }, [unseen.size, soundOn]);

  // Any click or key press unlocks the sound (browsers block audio until then).
  useEffect(() => {
    if (!enabled || !soundOn || audio !== 'locked') return;
    const unlock = () => void unlockAudio();
    document.addEventListener('click', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
  }, [enabled, soundOn, audio]);

  useTitleCount(unseen.size);

  const markSeen = useCallback(() => setUnseen(current => (current.size === 0 ? current : new Set())), []);
  const setSoundOn = useCallback((on: boolean) => {
    setSoundOnState(on);
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* Storage is optional. */ }
    if (on) void unlockAudio().then(ready => { if (ready) playChime(); });
  }, []);

  const newCount = board.data?.filter(order => order.status === 'PLACED').length ?? 0;
  const value = useMemo<LiveValue>(() => ({
    enabled, connection, unseen, markSeen, newCount,
    sound: { on: soundOn, setOn: setSoundOn, audio, unlock: unlockAudio },
  }), [enabled, connection, unseen, markSeen, newCount, soundOn, setSoundOn, audio]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useOrdersLive(): LiveValue {
  const context = useContext(LiveContext);
  if (!context) throw new Error('OrdersLiveProvider is required');
  return context;
}
