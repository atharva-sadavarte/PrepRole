import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {getUserQuota} from '../services/quotaService';
import {
  checkProEntitlement,
  getOfferings,
  findMonthlyPackage,
  findScanPackPackage,
  getLocalizedFallbackPrice,
} from '../services/purchaseService';
import {UserQuota} from '../types/resume';
import type {Session} from '@supabase/supabase-js';
import type {PurchasesPackage} from 'react-native-purchases';

export type PaywallReason = 'out_of_credits' | 'upgrade' | 'pro_info';

interface QuotaContextType {
  quota: UserQuota;
  planType: 'free' | 'pro';
  isPro: boolean;
  creditsRemaining: number;
  loading: boolean;
  refreshQuota: () => Promise<void>;
  showPaywall: boolean;
  paywallReason: PaywallReason;
  openPaywall: (reason?: PaywallReason) => void;
  closePaywall: () => void;
  monthlyPrice: string;
  packPrice: string;
  packages: PurchasesPackage[];
}

const defaultQuota: UserQuota = {
  user_id: '',
  plan_type: 'free',
  credits_remaining: 3,
  lifetime_scans_used: 0,
  pro_until: null,
};

const initialFallback = getLocalizedFallbackPrice();

const QuotaContext = createContext<QuotaContextType>({
  quota: defaultQuota,
  planType: 'free',
  isPro: false,
  creditsRemaining: 3,
  loading: false,
  refreshQuota: async () => {},
  showPaywall: false,
  paywallReason: 'upgrade',
  openPaywall: () => {},
  closePaywall: () => {},
  monthlyPrice: initialFallback.monthly,
  packPrice: initialFallback.pack,
  packages: [],
});

interface QuotaProviderProps {
  session: Session | null;
  children: ReactNode;
}

export const QuotaProvider: React.FC<QuotaProviderProps> = ({
  session,
  children,
}) => {
  const [quota, setQuota] = useState<UserQuota>(defaultQuota);
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason>('upgrade');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [monthlyPrice, setMonthlyPrice] = useState<string>(initialFallback.monthly);
  const [packPrice, setPackPrice] = useState<string>(initialFallback.pack);

  const loadPackagesAndPrices = useCallback(async () => {
    try {
      const pkgs = await getOfferings();
      if (pkgs && pkgs.length > 0) {
        setPackages(pkgs);
        const mPkg = findMonthlyPackage(pkgs);
        const pPkg = findScanPackPackage(pkgs);
        if (mPkg?.product?.priceString) {
          setMonthlyPrice(mPkg.product.priceString);
        }
        if (pPkg?.product?.priceString) {
          setPackPrice(pPkg.product.priceString);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPackagesAndPrices();
  }, [loadPackagesAndPrices]);

  const refreshQuota = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const [userQuota, isRevenueCatPro] = await Promise.all([
        getUserQuota(session.user.id),
        checkProEntitlement(),
        loadPackagesAndPrices(),
      ]);

      if (userQuota) {
        // If RevenueCat reports active pro entitlement, reflect pro plan
        const effectivePlan =
          isRevenueCatPro || userQuota.plan_type === 'pro' ? 'pro' : 'free';
        setQuota({
          ...userQuota,
          plan_type: effectivePlan,
        });
      } else if (isRevenueCatPro) {
        setQuota(prev => ({
          ...prev,
          plan_type: 'pro',
        }));
      }
    } catch (err) {
      console.warn('Failed to refresh user quota:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, loadPackagesAndPrices]);

  useEffect(() => {
    if (session?.user?.id) {
      refreshQuota();
    } else {
      setQuota(defaultQuota);
    }
  }, [session?.user?.id, refreshQuota]);

  const openPaywall = useCallback((reason: PaywallReason = 'upgrade') => {
    setPaywallReason(reason);
    setShowPaywall(true);
  }, []);

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
  }, []);

  const isPro = quota.plan_type === 'pro';
  const creditsRemaining = isPro ? Infinity : quota.credits_remaining;

  return (
    <QuotaContext.Provider
      value={{
        quota,
        planType: quota.plan_type,
        isPro,
        creditsRemaining,
        loading,
        refreshQuota,
        showPaywall,
        paywallReason,
        openPaywall,
        closePaywall,
        monthlyPrice,
        packPrice,
        packages,
      }}>
      {children}
    </QuotaContext.Provider>
  );
};

export const useQuota = () => useContext(QuotaContext);
