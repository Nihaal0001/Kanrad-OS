-- ============================================================================
-- AI Daily Market Brief + retroactive market_news DDL
--
-- market_briefs holds one AI-generated brief per day (headline, bullets,
-- cost-impact notes, top story ids) produced by the market-brief cron from
-- the last 48h of news + commodity price moves. Content is JSONB so the
-- shape can evolve without migrations.
--
-- market_news was created out-of-band in the SQL editor long ago and had no
-- versioned DDL in the repo; the IF NOT EXISTS block below is a no-op on the
-- live database and simply documents the shape for fresh environments.
--
-- Apply in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  source TEXT,
  published_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_news_published_at_idx ON market_news (published_at DESC);
CREATE INDEX IF NOT EXISTS market_news_created_at_idx  ON market_news (created_at DESC);

CREATE TABLE IF NOT EXISTS market_briefs (
  brief_date DATE PRIMARY KEY,
  content    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE market_briefs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_briefs' AND policyname='market_briefs_read_authenticated') THEN
    CREATE POLICY "market_briefs_read_authenticated" ON market_briefs
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_briefs' AND policyname='market_briefs_write_admin') THEN
    CREATE POLICY "market_briefs_write_admin" ON market_briefs
      FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
