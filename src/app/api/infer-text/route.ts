import { NextRequest, NextResponse } from "next/server";
import * as ort from "onnxruntime-node";
import path from "path";
import fs from "fs";
import { z } from "zod";

// ── Constants ────────────────────────────────────────────────────────────────
const MODEL_FILE = "llmshield_distilbert.onnx";
const MAX_LENGTH = 128;
const LABELS = ["safe", "harmful"] as const;

// ── Zod schema ───────────────────────────────────────────────────────────────
const InferTextSchema = z.object({
  text: z.string().min(1, "Prompt text is required").max(2048),
});

// ── Session + vocab caches ───────────────────────────────────────────────────
let cachedSession: ort.InferenceSession | null = null;
let cachedVocab: Map<string, number> | null = null;

function resolveModelDir(): string {
  return (
    process.env.MODEL_DIR ||
    path.join(process.cwd(), "public", "models", "onnx")
  );
}

async function getSession(): Promise<ort.InferenceSession> {
  if (!cachedSession) {
    const modelPath = path.join(resolveModelDir(), MODEL_FILE);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${MODEL_FILE}`);
    }
    cachedSession = await ort.InferenceSession.create(modelPath);
  }
  return cachedSession;
}

function getVocab(): Map<string, number> {
  if (!cachedVocab) {
    const vocabPath = path.join(
      resolveModelDir(),
      "tokenizer",
      "vocab.txt",
    );
    if (!fs.existsSync(vocabPath)) {
      throw new Error("Tokenizer vocab.txt not found");
    }
    const lines = fs.readFileSync(vocabPath, "utf-8").split("\n");
    cachedVocab = new Map<string, number>();
    for (let i = 0; i < lines.length; i++) {
      const token = lines[i].trimEnd();
      if (token.length > 0) cachedVocab.set(token, i);
    }
  }
  return cachedVocab;
}

// ── Minimal WordPiece tokenizer ──────────────────────────────────────────────
// Mirrors HuggingFace DistilBertTokenizer: lowercase → split → WordPiece
function tokenize(
  text: string,
  vocab: Map<string, number>,
  maxLength: number,
): { inputIds: BigInt64Array; attentionMask: BigInt64Array } {
  const CLS = vocab.get("[CLS]") ?? 101;
  const SEP = vocab.get("[SEP]") ?? 102;
  const PAD = vocab.get("[PAD]") ?? 0;
  const UNK = vocab.get("[UNK]") ?? 100;

  // Basic pre-tokenization: lowercase, strip accents, split on whitespace + punct
  const clean = text
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, " ") // strip non-ASCII
    .replace(/([.,!?;:()"\[\]{}])/g, " $1 ")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);

  // WordPiece encoding
  const tokens: number[] = [CLS];
  for (const word of words) {
    let start = 0;
    let isFirst = true;
    while (start < word.length) {
      let end = word.length;
      let found = false;
      while (start < end) {
        const substr = isFirst
          ? word.slice(start, end)
          : "##" + word.slice(start, end);
        const id = vocab.get(substr);
        if (id !== undefined) {
          tokens.push(id);
          start = end;
          found = true;
          isFirst = false;
          break;
        }
        end--;
      }
      if (!found) {
        tokens.push(UNK);
        break;
      }
    }
    if (tokens.length >= maxLength - 1) break;
  }
  tokens.push(SEP);

  // Truncate if necessary
  if (tokens.length > maxLength) tokens.length = maxLength;

  // Pad to maxLength
  const inputIds = new BigInt64Array(maxLength);
  const attentionMask = new BigInt64Array(maxLength);
  for (let i = 0; i < maxLength; i++) {
    if (i < tokens.length) {
      inputIds[i] = BigInt(tokens[i]);
      attentionMask[i] = BigInt(1);
    } else {
      inputIds[i] = BigInt(PAD);
      attentionMask[i] = BigInt(0);
    }
  }

  return { inputIds, attentionMask };
}

// ── Softmax ──────────────────────────────────────────────────────────────────
function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = InferTextSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`,
    );
    return NextResponse.json(
      { error: "Validation failed", issues },
      { status: 422 },
    );
  }

  const { text } = parsed.data;

  try {
    const vocab = getVocab();
    const session = await getSession();
    const { inputIds, attentionMask } = tokenize(text, vocab, MAX_LENGTH);

    const idsTensor = new ort.Tensor("int64", inputIds, [1, MAX_LENGTH]);
    const maskTensor = new ort.Tensor("int64", attentionMask, [1, MAX_LENGTH]);

    const t0 = Date.now();
    const outputs = await session.run({
      input_ids: idsTensor,
      attention_mask: maskTensor,
    });
    const elapsedMs = Date.now() - t0;

    const logits = Array.from(outputs.logits.data as Float32Array);
    const probs = softmax(logits);
    const predIdx = probs[1] > probs[0] ? 1 : 0;

    return NextResponse.json({
      label: LABELS[predIdx],
      confidence: probs[predIdx],
      probabilities: { safe: probs[0], harmful: probs[1] },
      logits,
      elapsedMs,
      tokenCount: inputIds.filter((v) => v !== BigInt(0)).length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown inference error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
