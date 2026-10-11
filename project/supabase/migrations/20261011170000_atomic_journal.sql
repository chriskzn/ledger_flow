-- Atomic journal posting for current Supabase deployment.
-- Deploy before updated UI. RLS still applies inside SECURITY INVOKER.
CREATE OR REPLACE FUNCTION public.post_journal_atomic(p_entry jsonb, p_lines jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid(); v_entry uuid; v_line jsonb;
  v_debit numeric(15,2) := 0; v_credit numeric(15,2) := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'At least two journal lines required';
  END IF;
  IF nullif(trim(p_entry->>'description'),'') IS NULL THEN RAISE EXCEPTION 'Description required'; END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    IF (v_line->>'debit')::numeric < 0 OR (v_line->>'credit')::numeric < 0 OR
      ((v_line->>'debit')::numeric > 0 AND (v_line->>'credit')::numeric > 0) OR
      ((v_line->>'debit')::numeric = 0 AND (v_line->>'credit')::numeric = 0) THEN
      RAISE EXCEPTION 'Invalid debit/credit line';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id=(v_line->>'account_id')::uuid AND user_id=v_user AND is_active) THEN
      RAISE EXCEPTION 'Account not owned by user or inactive';
    END IF;
    v_debit := v_debit + (v_line->>'debit')::numeric;
    v_credit := v_credit + (v_line->>'credit')::numeric;
  END LOOP;
  IF v_debit <= 0 OR v_debit <> v_credit THEN RAISE EXCEPTION 'Unbalanced journal'; END IF;
  INSERT INTO journal_entries(user_id,entry_date,reference,description,period_month,period_year,status,source)
  VALUES(v_user,(p_entry->>'entry_date')::date,p_entry->>'reference',p_entry->>'description',
    EXTRACT(MONTH FROM (p_entry->>'entry_date')::date)::int,
    EXTRACT(YEAR FROM (p_entry->>'entry_date')::date)::int,'posted','manual')
  RETURNING id INTO v_entry;
  INSERT INTO journal_lines(user_id,journal_entry_id,account_id,debit,credit,description)
  SELECT v_user,v_entry,(value->>'account_id')::uuid,(value->>'debit')::numeric,
    (value->>'credit')::numeric,value->>'description' FROM jsonb_array_elements(p_lines);
  RETURN v_entry;
END; $$;
REVOKE ALL ON FUNCTION public.post_journal_atomic(jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_journal_atomic(jsonb,jsonb) TO authenticated;
