/**
 * Local ONNX model test — runs with: node scripts/test_onnx.mjs
 * Uses onnxruntime-node (same runtime as onnxruntime-web but for Node)
 *
 * Install if needed: npm install onnxruntime-node --save-dev
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, "../public/models/onnx");

// Model definitions — (name, inputShape, numClasses, classNames)
const MODELS = [
    {
        file: "meddef1_chest_xray.onnx",
        dataset: "chest_xray",
        paper: "MedDef1 (FULL)",
        numClasses: 2,
        classes: ["NORMAL", "PNEUMONIA"],
    },
    {
        file: "meddef1_roct.onnx",
        dataset: "roct",
        paper: "MedDef1 (FULL)",
        numClasses: 4,
        classes: ["CNV", "DME", "DRUSEN", "NORMAL"],
    },
    {
        file: "vista_no_def_tbcr.onnx",
        dataset: "tbcr",
        paper: "VISTA NO_DEF Distill-v2",
        numClasses: 2,
        classes: ["Normal", "Tuberculosis"],
    },
];

async function testModel(def) {
    const modelPath = join(MODELS_DIR, def.file);

    if (!existsSync(modelPath)) {
        console.log(`  ⏭  SKIP: ${def.file} not found`);
        return null;
    }

    const sizeMB = (statSync(modelPath).size / 1024 / 1024).toFixed(1);

    // Dynamically import onnxruntime-node
    let ort;
    try {
        ort = await import("onnxruntime-node");
    } catch {
        console.log("  ✗  onnxruntime-node not installed. Run: npm install onnxruntime-node --save-dev");
        return null;
    }

    const session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
    });

    const input = session.inputNames[0];
    const inputMeta = session.inputMetadata?.[input];
    const shape = [1, 3, 224, 224];

    // Random dummy input
    const data = new Float32Array(shape.reduce((a, b) => a * b, 1)).fill(0.5);
    const tensor = new ort.Tensor("float32", data, shape);

    const t0 = performance.now();
    const result = await session.run({ [input]: tensor });
    const elapsed = (performance.now() - t0).toFixed(0);

    const outputKey = session.outputNames[0];
    const logits = result[outputKey].data;

    // Softmax
    const max = Math.max(...logits);
    const exps = Array.from(logits).map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((e) => e / sum);

    const predIdx = probs.indexOf(Math.max(...probs));

    return {
        file: def.file,
        paper: def.paper,
        dataset: def.dataset,
        sizeMB,
        inputShape: shape,
        outputShape: Array.from(result[outputKey].dims),
        numClasses: logits.length,
        expectedClasses: def.numClasses,
        classMatch: logits.length === def.numClasses,
        predClass: def.classes[predIdx] ?? `class_${predIdx}`,
        confidence: (probs[predIdx] * 100).toFixed(1),
        elapsedMs: elapsed,
    };
}

async function main() {
    console.log("\n=== MedDef ONNX Model Test ===\n");
    console.log(`Models dir: ${MODELS_DIR}\n`);

    if (!existsSync(MODELS_DIR)) {
        console.log("Models directory not found. Run downloads first.");
        process.exit(1);
    }

    const available = readdirSync(MODELS_DIR).filter((f) => f.endsWith(".onnx"));
    console.log(`Found ${available.length} ONNX file(s): ${available.join(", ")}\n`);

    for (const def of MODELS) {
        console.log(`── ${def.paper} [${def.dataset}] ──────────────────`);
        const r = await testModel(def);
        if (r) {
            console.log(`  File:       ${r.file} (${r.sizeMB} MB)`);
            console.log(`  Input:      float32 ${r.inputShape.join("×")}`);
            console.log(`  Output:     ${r.outputShape.join("×")} classes`);
            console.log(`  Classes OK: ${r.classMatch ? "✓" : `✗ got ${r.numClasses}, expected ${r.expectedClasses}`}`);
            console.log(`  Dummy pred: ${r.predClass} (${r.confidence}% confidence)`);
            console.log(`  Latency:    ${r.elapsedMs}ms (CPU)\n`);
        }
    }

    console.log("=== Done ===\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
