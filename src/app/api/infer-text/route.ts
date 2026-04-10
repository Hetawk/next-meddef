import { NextRequest, NextResponse } from "next/server";
import * as ort from "onnxruntime-node";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { resolveModelDir } from "@/lib/model-path";

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

// ── Rule-based fallback layer ─────────────────────────────────────────────────
// Catches adversarial prompts that fall outside the neural classifier's training
// distribution — medical fraud, indirect harm, obfuscated instructions, etc.
// This implements the "rule-based attack pattern detection" layer described in
// the LLMShield pipeline (Chapter 5, Section 5.2.2).
const HARMFUL_PATTERNS: RegExp[] = [
  // Medical fraud / falsification
  /manipulate.{0,40}(x.?ray|scan|mri|ct|image|result|report)/i,
  /falsif.{0,30}(medical|result|report|record|diagnosis)/i,
  /fake.{0,30}(medical|diagnosis|sick|disease|result)/i,
  /appear.{0,20}(sick|ill|positive|negative).{0,30}(money|fraud|insurance|claim)/i,
  /make.{0,20}(person|patient|someone).{0,30}(appear|look|seem).{0,20}(sick|ill|positive)/i,
  // Medical harm
  /lethal.{0,30}(dose|dosage|amount|quantity)/i,
  /how.{0,20}(to|do|can).{0,30}(overdose|kill|poison).{0,20}(patient|person|someone)/i,
  /synthe?si[sz]e?.{0,30}(drug|opioid|fentanyl|methamphetamine|cocaine|bioweapon)/i,
  /bioweapon|weaponi[sz]e?.{0,30}(virus|bacteria|pathogen)/i,
  /cultivat.{0,30}(pathogen|virus|bacteria|anthrax|plague)/i,
  // Fraud / financial crime
  /insurance.{0,30}(fraud|scam|claim).{0,30}(sick|medical|fake)/i,
  /get.{0,30}money.{0,30}(fake|false|manipulat).{0,30}(medical|sick|result)/i,
  // Cyberattack / exploit
  /exploit.{0,30}(vulnerabilit|system|software|server|database)/i,
  /sql.{0,10}injection|xss.{0,10}attack|remote.{0,10}code.{0,10}execution/i,
  /ransomware|malware|keylogger|rootkit|backdoor.{0,20}(install|create|deploy)/i,
  /hack.{0,20}(into|access).{0,30}(database|server|system|network|account)/i,
  // Weapons / violence
  /how.{0,20}(to|do).{0,30}(make|build|create|assemble).{0,30}(bomb|explosive|weapon|gun)/i,
  /step.{0,10}by.{0,10}step.{0,20}(kill|murder|attack|shoot)/i,
  // Dicom / medical imaging manipulation
  /dicom.{0,40}(manipulat|modif|alter|tamper|edit)/i,
  /alter.{0,30}(medical.image|scan|mri|ct.scan|radiolog)/i,
];

function ruleBasedCheck(text: string): { triggered: boolean; pattern?: string } {
  for (const re of HARMFUL_PATTERNS) {
    if (re.test(text)) {
      return { triggered: true, pattern: re.source };
    }
  }
  return { triggered: false };
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

    // Rule-based fallback: override neural result if a harmful pattern is matched
    const ruleCheck = ruleBasedCheck(text);
    const predIdx = ruleCheck.triggered ? 1 : (probs[1] > probs[0] ? 1 : 0);

    return NextResponse.json({
      label: LABELS[predIdx],
      confidence: ruleCheck.triggered ? 0.99 : probs[predIdx],
      probabilities: ruleCheck.triggered
        ? { safe: 0.01, harmful: 0.99 }
        : { safe: probs[0], harmful: probs[1] },
      logits,
      elapsedMs,
      tokenCount: inputIds.filter((v) => v !== BigInt(0)).length,
      detectionLayer: ruleCheck.triggered ? "rule-based" : "neural",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown inference error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
