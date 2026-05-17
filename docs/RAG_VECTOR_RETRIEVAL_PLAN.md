# RAG / Vector Retrieval Migration Plan

> **Status:** Deferred. Build when triggered (see "Trigger conditions" below). Not premature today.
> **Last updated:** 2026-04-29
> **Owner:** Francis

## TL;DR

Move notebook chat from "load all material content into the LLM context" to "embed user query, retrieve top-K most relevant chunks via pgvector cosine search, pass only those to the LLM." Use Google's `text-embedding-005` (or `text-embedding-004` via Gemini API) for embeddings, store vectors in a new `material_chunks` table, orchestrate via Supabase's Automatic Embeddings pipeline (pgmq + pg_net + pg_cron + Edge Function).

This is the right architecture *eventually*. It is **not** the right thing to build today (one active user, ~30 materials max, well within Gemini 2.5 Flash's 1M-token context window). Build it when one of the trigger conditions below turns red.

## Why we're deferring (and why we considered it)

### Original concern (Peyton's signup, 2026-04-28)

Peyton uploaded 27 PDFs (~135k chars, ~34k tokens) into one notebook for an APMA 3080 linear algebra final. Current `notebook-chat/index.ts:170-194` concatenates whole materials (capped 50k chars each) into the system prompt with no retrieval — naive dump-everything approach. With many materials this:

- Wastes tokens (every chat resends full corpus)
- Dilutes attention quality (the "lost in the middle" problem)
- Has no source-of-truth tracking for citations
- Scales linearly in cost with material count

### Why it's not urgent today

At Peyton's scale, the cost and quality math:

| Metric | Naive (today) | RAG (proposed) | Actual difference |
|---|---|---|---|
| Tokens per chat | ~40k | ~5k | 8x reduction |
| Cost per chat (Gemini 2.5 Flash input @ $0.30/M) | $0.012 | $0.002 | $0.010/chat |
| Latency | baseline | -1-2s TTFT | small win |
| Quality | "good enough" | better attention focus | hard to measure at this scale |

With 4 active users averaging ~5 chats/week each: ~$0.96/month total chat input cost. RAG would save ~$0.80/month. **Not worth 1-2 days of engineering at current scale.**

Gemini 2.5 Flash's 1M-token window comfortably fits notebooks up to ~80 dense PDFs before the context window itself becomes the constraint.

## Trigger conditions for revisiting

Build RAG when **any** of these turn red:

1. **Cost per active user > ~$1/month** chat input. Currently ~$0.04. Crosses ~$1 around 100 active users with current usage patterns.
2. **Median notebook size > 50 materials.** Currently 27 max. Crosses around the time you have a few power users uploading whole courses.
3. **User-reported quality issues** ("chat couldn't find this in my notes when it clearly is in there"). Watch Sentry, support email, in-app feedback.
4. **A user uploads >100 materials in one notebook.** This blows past the current chat model's effective context window (despite the 1M ceiling, retrieval accuracy degrades meaningfully past 64-128k tokens of dense content per RULER/NIAH benchmarks).

Set up a weekly review of these signals. Probably one Supabase MCP query for material counts + glance at OpenRouter dashboard for tokens.

## Decisions made

These were settled in the planning discussion and shouldn't need re-litigating:

### 1. Vector store: pgvector on Supabase
- Already in Postgres. RLS-compatible. SQL-native (combine vector + relational filters in one query).
- HNSW index with defaults (`m=16, ef_construction=64`). Re-tune to `m=32, ef_construction=80` only past ~1M chunks.
- No managed vector DB (Pinecone, Weaviate, etc.). Supabase docs and benchmarks favor pgvector for this scale.

### 2. Embedding model: Google `text-embedding-005`
- $0.006 per 1M tokens. Cheapest production-grade option.
- 768-dim. Good enough quality (~63 MTEB).
- Reuses Google API auth that already exists for Gemini calls in `pdf-processor.ts`.
- Alternative considered: Voyage `voyage-3-large` for domain-specific quality lift (~68 MTEB on technical content). Defer until we have evidence Google's quality is insufficient on math content. Swap is one-line change + re-embed pass.

### 3. Orchestration: Supabase Automatic Embeddings pattern
- pgmq (queue) + pg_net (async HTTP) + pg_cron (scheduling) + Edge Function (worker).
- Built-in retry logic on failure.
- Triggers on `materials` insert/update where `processed = true`.
- No custom job runner code needed.

### 4. Retrieval shape: top-K (K=8) cosine
- Naive top-K only for v1. Skip hybrid search and reranking.
- Phase 2.5: add full-text search (BM25 via Postgres `tsvector`) merged with vector via Reciprocal Rank Fusion (one SQL query).
- Phase 3: add Cohere rerank pass on top-20 → top-5. Anthropic's benchmark: 67% reduction in retrieval failure rate. Build only if v1 quality proves insufficient.

### 5. Default scope: full notebook with manual override
- Default behavior: vector search across the entire notebook's chunks.
- If user has materials selected via `SourceSelectionModal`, scope retrieval to those materials only (`AND material_id IN (...)`).
- Two-line change to existing query.

### 6. Math content: strip LaTeX before embedding
- LaTeX commands (`\frac{1}{2}`, `\mathbb{R}^n`) tokenize as opaque character soup, hurting semantic matching.
- Stripped version is used for embedding only. Original text stays in `material_chunks.content` so the LLM sees the raw markup at chat time.
- Strip with simple regex replacements: `\frac{a}{b}` → `a/b`, `\mathbb{R}` → `R`, etc. Don't need a full parser — heuristic is fine.

## Decisions still open

These need to be answered before code is written, but can be answered in 5 minutes of investigation:

### Google embedding API endpoint

Two options:

| Option | Auth | Model | Setup |
|---|---|---|---|
| **Generative Language API (Gemini API)** | API key | `text-embedding-004` | Simplest. One env var. |
| **Vertex AI Embeddings** | Service account JSON | `text-embedding-005` | Higher rate limits. More setup. |

**Recommendation:** start with Gemini API. Quality difference is negligible at our scale. Switch to Vertex if rate limits hit. Verify which auth path the existing `pdf-processor.ts` Gemini call uses — reuse it if possible.

### Chunk size and overlap

Three reasonable presets:

| Preset | Size | Overlap | When to use |
|---|---|---|---|
| Conservative | 256 tokens | 50 | Lots of small focused chunks. More embedding cost. |
| **Standard** | 500 tokens | 100 | Industry default. Balanced. |
| Larger | 1000 tokens | 200 | Fewer chunks, more context per chunk. |

**Recommendation:** Standard (500/100). Math concepts often span paragraphs; 256 fragments derivations from formulas. 1000 over-stuffs irrelevant content into each chunk.

### Past papers — chunk-per-question or chunk-by-size?

`materials.meta.content_classification.type === 'past_paper'` already detects past papers. Semantic boundaries here are exam questions, not character counts. Detect "Question N" / "1." / "(a)" patterns and chunk per question.

**Recommendation:** ship Phase 2 with simple recursive chunking for v1. Add past-paper-aware chunker in a Phase 2.5 if a real past-paper-heavy user shows up. Premature now.

## Implementation plan (when triggered)

Total estimated effort: **~6-8 focused hours** across 1-2 days.

### Phase 0: Prerequisites (~30 min)

- Enable pgvector extension in Supabase (free tier supports it)
- Get Google API key with Generative Language API enabled
- Add `GOOGLE_EMBEDDING_API_KEY` to Supabase secrets
- Verify `pgmq` and `pg_cron` extensions are available (default for Supabase projects)

### Phase 1: Schema migration (~1 hour)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE material_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,           -- raw chunk content (with LaTeX) for LLM consumption
  embedding_text TEXT,             -- LaTeX-stripped version used for embedding (debug-only)
  token_count INT,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX material_chunks_embedding_idx ON material_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX material_chunks_notebook_idx ON material_chunks(notebook_id);
CREATE INDEX material_chunks_material_idx ON material_chunks(material_id);

ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own chunks" ON material_chunks
  FOR SELECT USING (auth.uid() = user_id);
```

A `materials.embeddings_generated boolean` column already exists — reuse it as the "done" flag.

### Phase 2: Chunk + embed edge function (~3-4 hours)

New edge function `embed-material`:

1. Receives `{ material_id }` from queue
2. Loads `materials.content`
3. Splits via recursive paragraph-aware chunker — 500 tokens, 100 token overlap, paragraph/sentence-aware splits
4. For each chunk:
   - Strip LaTeX commands → `embedding_text`
   - Call Google embedding API on `embedding_text`
   - Insert row into `material_chunks` with both `content` (raw) and `embedding`
5. Set `materials.embeddings_generated = true`

Trigger: `AFTER UPDATE ON materials WHEN (NEW.processed = true AND NEW.embeddings_generated = false)` → `pgmq.send('embed_jobs', json_build_object('material_id', NEW.id))`.

Scheduler: `pg_cron` job every 10 seconds → `pg_net` async POST to edge function with batched job IDs.

### Phase 3: Modify `notebook-chat` (~1-2 hours)

Replace the current dump-everything logic at `notebook-chat/index.ts:170-194`:

```ts
// Embed the user's question
const queryEmbedding = await embedText(sanitizedMessage);

// Retrieve top-K chunks
const { data: chunks } = await supabase.rpc('match_material_chunks', {
  query_embedding: queryEmbedding,
  notebook_id_filter: notebook_id,
  material_ids_filter: sanitizedMaterialIds.length > 0 ? sanitizedMaterialIds : null,
  match_count: 8,
});

// Build context with source tags for citations
const context = chunks
  .map(c => `[Source: ${c.filename}]\n${c.content}`)
  .join('\n\n');
```

Plus a helper RPC `match_material_chunks(query_embedding, notebook_id, material_ids, match_count)` that runs the cosine query.

### Phase 4: Backfill (~10 min)

```sql
-- Enqueue embed jobs for all existing processed materials
INSERT INTO pgmq.q_embed_jobs (message)
SELECT jsonb_build_object('material_id', id)
FROM materials
WHERE processed = true
  AND embeddings_generated = false;
```

For Peyton's 27 materials → ~270 chunks → ~5 minutes wall-clock to fully process via the cron worker.

### Phase 5 (deferred): Hybrid + rerank

Build only if v1 retrieval quality is insufficient. Order:
1. Add `tsvector` column on chunks + GIN index
2. RRF query merging vector top-N + FTS top-N
3. Cohere rerank API on top-20 → top-5

Anthropic benchmark suggests up to 67% reduction in top-K retrieval failure rate from rerank alone.

## Cost projections

At Google `text-embedding-004` pricing ($0.006/1M tokens):

| Stage | Volume | Cost |
|---|---|---|
| Initial embed (Peyton's 27 materials) | ~135k tokens | $0.0008 |
| Per chat query embed | ~30 tokens | $0.0000002 |
| 1k DAU × 100 chats/month | ~3M tokens | $0.018/month |
| Storage: 1M chunks × 768 dim × 4 bytes | ~3 GB | included in Supabase plan |

**Total RAG running cost at 1k DAU: ~$1-3/month.** Negligible.

Compare to current naive approach at 1k DAU: ~$4,050/month input tokens to Gemini 2.5 Flash. RAG saves roughly that amount at scale.

## Backfill strategy

- Pre-trigger: zero historical chunks. New uploads get chunked automatically.
- Trigger fires (e.g., user count crosses 100): run the Phase 4 backfill SQL once. Cron worker chews through all existing materials in minutes.
- No downtime. Old chat path keeps working until the new one is deployed. Rollback is "redeploy old `notebook-chat` from git" + DB rows are additive.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Bad chunking fragments topics | Recursive paragraph-aware splitting + 100 token overlap |
| Embedding model failures during processing | pgmq automatic retry on failure |
| Stale chunks if material content changes | Trigger fires on UPDATE too; old chunks deleted by cascade or in edge function |
| Hot path latency (embed + vector query adds ~100-200ms) | Acceptable; chat is already async with streaming |
| Rate limits on Google embedding API | Batch chunks per request (Google supports up to 100 inputs per call) |
| Wrong dimension column | Pick once and stick with it. Switching = re-embed all chunks once. Cheap. |
| RLS bypass | Test thoroughly. Verify a user cannot query another user's chunks even with crafted SQL. |

## Quick wins to ship instead of RAG (until trigger fires)

These give 80% of the UX improvement at 10% of the engineering cost:

### 1. Source citations in chat answers (~30 min)

Tighten the `notebook-chat` system prompt to require structured citations:

> "When making a claim from a specific source, append `[Source: filename]` immediately after the claim. Only cite filenames present in your context."

Then parse `[Source: filename]` patterns client-side in `ChatTab.tsx` and render as small pill-shaped badges. Tappable to open material in source viewer.

The current prompt has a soft instruction (rule #4) but no structured tag, so compliance is inconsistent and the client doesn't render anything.

### 2. Topic tags at material ingestion (~2-3 hours)

One cheap LLM call during PDF processing: "What 1-3 topics does this material cover?" Store in `materials.meta.topics` as `string[]`. Costs ~$0.001/material via Gemini Flash.

Use later for:
- Filterable chat scope (tap a topic chip → narrow context)
- Auto-grouping flashcards by topic instead of one mega-set
- "Suggested questions" UI based on topic coverage

### 3. SourceSelectionModal UX with topic chips (~3-4 hours)

Show topic tags as filter chips in the modal. Let users tap "linear algebra: eigenvalues" to narrow to materials covering that topic. Reuses existing `selected_material_ids` machinery.

### 4. Better material count UI (~1 hour)

Show "27 sources" badge prominently in chat header. Encourage users with large notebooks to use SourceSelectionModal for focused queries (manual workaround for the no-RAG limitation).

## References

External:
- [Supabase Automatic Embeddings docs](https://supabase.com/docs/guides/ai/automatic-embeddings)
- [pgvector HNSW index docs](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes)
- [RAG with Permissions (Supabase RLS pattern)](https://supabase.com/docs/guides/ai/rag-with-permissions)
- [Google `text-embedding-004` model card](https://ai.google.dev/gemini-api/docs/embeddings)
- [Lost in the Middle (Liu et al., 2023)](https://arxiv.org/abs/2307.03172) — practical retrieval degradation in long contexts
- [Anthropic contextual retrieval benchmark](https://www.anthropic.com/news/contextual-retrieval) — rerank quality data

Internal:
- `supabase/functions/notebook-chat/index.ts:170-194` — current naive concatenation
- `supabase/functions/_shared/material-processing/pdf-processor.ts` — PDF extraction (where chunking would hook in)
- `materials.embeddings_generated` boolean column — reuse as "done" flag
- `notebook_chat_messages.sources jsonb` — currently stores all-in-context IDs; could be repurposed for actual-cited IDs once RAG ships
