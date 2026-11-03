-- Study cafe schema (standard PostgreSQL, re-runnable). See docs/DB_DESIGN.md.

CREATE TABLE IF NOT EXISTS users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  email text,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS law_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('law','decree','notice')),
  title text NOT NULL,
  promulgation_no text NOT NULL,
  promulgated_on date,
  effective_on date NOT NULL,
  is_upcoming boolean NOT NULL DEFAULT false,
  source text NOT NULL CHECK (source IN ('api','pdf','seed')),
  fetched_at timestamptz,
  UNIQUE (kind, promulgation_no)
);

CREATE TABLE IF NOT EXISTS law_chapters (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES law_documents(id) ON DELETE CASCADE,
  label text NOT NULL,
  title text NOT NULL,
  sort_order int NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS law_chapters_document_label_key ON law_chapters (document_id, label);

CREATE TABLE IF NOT EXISTS articles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES law_documents(id) ON DELETE CASCADE,
  chapter_id bigint REFERENCES law_chapters(id) ON DELETE SET NULL,
  article_key text NOT NULL,
  title text NOT NULL,
  body text,
  sort_order int NOT NULL,
  UNIQUE (document_id, article_key)
);

CREATE TABLE IF NOT EXISTS article_links (
  from_article_id bigint NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  to_article_id bigint NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  note text,
  PRIMARY KEY (from_article_id, to_article_id)
);

CREATE TABLE IF NOT EXISTS areas (
  id text PRIMARY KEY,
  roman text NOT NULL,
  name text NOT NULL,
  weight int NOT NULL CHECK (weight BETWEEN 0 AND 100),
  sort_order int NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
  id text PRIMARY KEY,
  area_id text NOT NULL REFERENCES areas(id),
  name text NOT NULL,
  law_summary text,
  decree_summary text,
  sort_order int NOT NULL
);

CREATE TABLE IF NOT EXISTS unit_leaves (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id text NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  label text NOT NULL,
  ref text NOT NULL,
  sort_order int NOT NULL
);

CREATE TABLE IF NOT EXISTS unit_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id text NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  label text NOT NULL,
  law_ref text,
  decree_ref text,
  is_key boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL
);

CREATE TABLE IF NOT EXISTS anchors (
  article_key text PRIMARY KEY,
  label text NOT NULL,
  area_id text NOT NULL REFERENCES areas(id),
  is_new boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS mnemonics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  area_id text NOT NULL REFERENCES areas(id),
  title text NOT NULL,
  body text NOT NULL,
  sort_order int NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  area_id text REFERENCES areas(id),
  deck text NOT NULL CHECK (deck IN ('law','decree','concept')),
  front text NOT NULL,
  answer text NOT NULL,
  extra text,
  sort_order int NOT NULL
);
ALTER TABLE cards ALTER COLUMN area_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cards_deck_sort_order_key ON cards (deck, sort_order);

CREATE TABLE IF NOT EXISTS history_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doc_kind text NOT NULL CHECK (doc_kind IN ('law','decree')),
  date_label text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  article_keys text[] NOT NULL DEFAULT '{}',
  is_key boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL
);

CREATE TABLE IF NOT EXISTS user_unit_reads (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  reads smallint NOT NULL CHECK (reads BETWEEN 0 AND 3),
  PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS user_card_levels (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id bigint NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  exam_date date
);

CREATE TABLE IF NOT EXISTS questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id bigint NOT NULL REFERENCES users(id),
  article_id bigint REFERENCES articles(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_article_id ON questions(article_id);

CREATE TABLE IF NOT EXISTS answers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  author_id bigint NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_answers_question_created ON answers(question_id, created_at);
