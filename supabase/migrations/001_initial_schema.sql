-- ============================================================
-- Vira Plants — Initial Schema
-- Apply via Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================

-- ── Helper: auto-update updated_at ──

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url  TEXT,
  location    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ════════════════════════════════════
-- PLANTS
-- ════════════════════════════════════

CREATE TABLE plants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nickname                TEXT NOT NULL,
  species                 TEXT,
  location                TEXT,
  orientation             TEXT,
  pot_size                TEXT,
  photo_url               TEXT,
  health                  TEXT,
  connection_type         TEXT DEFAULT 'manual' CHECK (connection_type IN ('manual', 'vira_pot')),
  vira_pot_id             TEXT,
  water_frequency_days    INTEGER,
  fertilize_frequency_days INTEGER,
  care_notes              TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER plants_updated_at
  BEFORE UPDATE ON plants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plants"
  ON plants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plants"
  ON plants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plants"
  ON plants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plants"
  ON plants FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════
-- CARE EVENTS
-- ════════════════════════════════════

CREATE TABLE care_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    UUID REFERENCES plants(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('water', 'fertilize', 'repot', 'prune', 'photo_update')),
  source      TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'vira_pot', 'auto')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE care_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own care events"
  ON care_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own care events"
  ON care_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own care events"
  ON care_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own care events"
  ON care_events FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════
-- REMINDERS
-- ════════════════════════════════════

CREATE TABLE reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    UUID REFERENCES plants(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('water', 'fertilize', 'repot', 'prune', 'custom')),
  due_date    TIMESTAMPTZ NOT NULL,
  completed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reminders"
  ON reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON reminders FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════
-- SPECIES CACHE
-- ════════════════════════════════════

CREATE TABLE species_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_name  TEXT UNIQUE NOT NULL,
  care_data     JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER species_cache_updated_at
  BEFORE UPDATE ON species_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: authenticated users can read, only service role can write
ALTER TABLE species_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read species cache"
  ON species_cache FOR SELECT
  TO authenticated
  USING (true);

-- ════════════════════════════════════
-- STORAGE: plant-photos bucket
-- ════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', true);

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'plant-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update their own photos
CREATE POLICY "Users can update own photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'plant-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own photos
CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'plant-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access for plant photos
CREATE POLICY "Public read access for plant photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'plant-photos');
