import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Company } from '@/types';

export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCompany = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('companies')
      .select('*')
      .maybeSingle();
    setCompany(data as Company | null);
    setLoading(false);
  };

  useEffect(() => {
    loadCompany();
  }, []);

  return { company, loading, reload: loadCompany, setCompany };
}
