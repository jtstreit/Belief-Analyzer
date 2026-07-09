import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Modality = 'rebt' | 'cbt';

interface ModalityContextValue {
  modality: Modality;
  setModality: (m: Modality) => Promise<void>;
  isLoaded: boolean;
}

const STORAGE_KEY = '@therapy_modality';

const ModalityContext = createContext<ModalityContextValue>({
  modality: 'rebt',
  setModality: async () => {},
  isLoaded: false,
});

export function ModalityProvider({ children }: { children: React.ReactNode }) {
  const [modality, setModalityState] = useState<Modality>('rebt');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'cbt' || val === 'rebt') setModalityState(val);
      setIsLoaded(true);
    });
  }, []);

  const setModality = async (m: Modality) => {
    setModalityState(m);
    await AsyncStorage.setItem(STORAGE_KEY, m);
  };

  return (
    <ModalityContext.Provider value={{ modality, setModality, isLoaded }}>
      {children}
    </ModalityContext.Provider>
  );
}

export function useModality() {
  return useContext(ModalityContext);
}

/** Human-readable labels for each modality */
export const MODALITY_LABELS: Record<Modality, { name: string; short: string; color: string }> = {
  rebt: { name: 'REBT (Ellis)', short: 'REBT', color: '#F59E0B' },
  cbt:  { name: 'CBT (Beck)', short: 'CBT',  color: '#6366F1' },
};
