import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import Purchases, {
  CustomerInfo, PurchasesOffering, PurchasesPackage, PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { usePocket } from '@/providers/PocketProvider';
import { hasPremium } from '@/lib/subscriptions';

type Action = 'purchase' | 'restore' | 'manage' | null;
type SubscriptionState = {
  loading: boolean;
  hasAccess: boolean;
  offering: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  error: string | null;
  action: Action;
  refresh(): Promise<void>;
  purchase(pkg: PurchasesPackage): Promise<boolean>;
  restore(): Promise<boolean>;
  manage(): Promise<void>;
};

const Context = createContext<SubscriptionState | null>(null);
// Serialize account changes so a slow login cannot replace a newer account.
let identityQueue: Promise<void> = Promise.resolve();
let sdkConfigured = false;
const apiKey = Platform.OS === 'android'
  ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
  : Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY : undefined;
const unavailable = Platform.OS === 'web'
  ? 'Google Play subscriptions are available in the Android app, not this browser preview.'
  : 'Subscriptions are not configured for this platform yet. Please try again later.';
const message = (e: unknown) =>
  e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
    ? e.message : 'Could not contact the store. Check your connection and try again.';

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { session } = usePocket();
  const userId = session?.user.id ?? null;
  const latestUser = useRef(userId);
  latestUser.current = userId;
  const readyUser = useRef<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const working = useRef<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());
  const [attempt, setAttempt] = useState<number>(0);

  const refresh = useCallback(async () => {
    if (!userId || latestUser.current !== userId) return;
    if (readyUser.current !== userId) {
      setAttempt((value) => value + 1);
      return;
    }
    setError(null);
    const [customer, catalog] = await Promise.allSettled([
      Purchases.getCustomerInfo(), Purchases.getOfferings(),
    ]);
    if (latestUser.current !== userId || readyUser.current !== userId) return;
    setNow(Date.now());
    if (customer.status === 'fulfilled') setInfo(customer.value);
    else setError(message(customer.reason));
    if (catalog.status === 'fulfilled') {
      setOffering(catalog.value.current);
      if (!catalog.value.current?.availablePackages.length) {
        setError('Plans are not available from Google Play yet. You can restore an existing purchase or retry later.');
      }
    } else setError(message(catalog.reason));
  }, [userId]);

  useEffect(() => {
    let live = true;
    let listener: ((value: CustomerInfo) => void) | undefined;
    readyUser.current = null;
    setInitializing(true);
    setOwner(null);
    setInfo(null);
    setOffering(null);
    setError(null);
    identityQueue = identityQueue.catch(() => {}).then(async () => {
      if (!live) return;
      try {
        if (!userId) {
          if (sdkConfigured && !(await Purchases.isAnonymous())) await Purchases.logOut();
          return;
        }
        if (!apiKey) throw new Error(unavailable);
        if (!sdkConfigured) {
          Purchases.configure({ apiKey, appUserID: userId });
          sdkConfigured = true;
        } else {
          await Purchases.logIn(userId);
        }
        if (!live || latestUser.current !== userId) return;
        readyUser.current = userId;
        listener = (value) => {
          if (live && latestUser.current === userId && readyUser.current === userId) {
            setInfo(value);
            setNow(Date.now());
          }
        };
        Purchases.addCustomerInfoUpdateListener(listener);
        await refresh();
      } catch (e) {
        if (live) setError(message(e));
      } finally {
        if (live) {
          setOwner(userId);
          setInitializing(false);
        }
      }
    });
    return () => {
      live = false;
      if (listener) Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [userId, refresh, attempt]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const timer = setInterval(() => {
      setNow(Date.now());
      if (AppState.currentState === 'active') void refresh();
    }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [refresh]);

  const run = async (kind: Exclude<Action, null>, work: () => Promise<CustomerInfo | null>): Promise<boolean> => {
    if (working.current) return false;
    if (!userId || (kind !== 'manage' && (readyUser.current !== userId || !apiKey))) {
      setError(unavailable);
      return false;
    }
    working.current = true;
    setAction(kind);
    setError(null);
    try {
      const value = await work();
      if (latestUser.current !== userId || readyUser.current !== userId) return false;
      if (!value) return true;
      setInfo(value);
      setNow(Date.now());
      const active = hasPremium(value);
      if (!active) setError(kind === 'restore'
        ? 'No active Pocket subscription was found for this store account.'
        : 'Your purchase has not granted access yet. If payment is pending, wait for store confirmation, then restore purchases.');
      return active;
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? e.code : null;
      if (latestUser.current === userId && code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        setError(message(e));
      }
      return false;
    } finally {
      working.current = false;
      setAction(null);
    }
  };

  return (
    <Context.Provider value={{
      loading: !!userId && (initializing || owner !== userId),
      hasAccess: owner === userId && !!userId && hasPremium(info, now),
      customerInfo: owner === userId ? info : null,
      offering: owner === userId ? offering : null,
      error, action, refresh,
      purchase: (pkg) => run('purchase', async () => (await Purchases.purchasePackage(pkg)).customerInfo),
      restore: () => run('restore', () => Purchases.restorePurchases()),
      manage: async () => {
        await run('manage', async () => {
          await Linking.openURL(info?.managementURL ?? (Platform.OS === 'ios'
            ? 'https://apps.apple.com/account/subscriptions'
            : 'https://play.google.com/store/account/subscriptions?package=com.pocketwealth.app'));
          return null;
        });
      },
    }}>
      {children}
    </Context.Provider>
  );
}

export function useSubscription(): SubscriptionState {
  const value = useContext(Context);
  if (!value) throw new Error('useSubscription must be inside SubscriptionProvider');
  return value;
}
