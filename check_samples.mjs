import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname; // project root

async function inferImage(sess, imgPath, mean, std, classes) {
    const { data, info } = await sharp(imgPath)
        .resize(224, 224)
        .raw()
        .toBuffer({ resolveWithObject: true });
    const channels = info.channels; // 1 or 3 or 4
    const tensor = new Float32Array(3 * 224 * 224);
    for (let i = 0; i < 224 * 224; i++) {
        for (let c = 0; c < 3; c++) {
            const srcC = channels === 1 ? 0 : c;
            const pixVal = data[i * channels + srcC];
            tensor[c * 224 * 224 + i] = (pixVal / 255 - mean[c]) / std[c];
        }
    }
    const inputName = sess.inputNames[0];
    const feed = { [inputName]: new ort.Tensor('float32', tensor, [1, 3, 224, 224]) };
    const out = await sess.run(feed);
    const logits = Array.from(out[sess.outputNames[0]].data);
    const max = Math.max(...logits);
    const exps = logits.map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(e => e / sum);
    const idx = probs.indexOf(Math.max(...probs));
    return { pred: classes[idx], conf: (probs[idx] * 100).toFixed(1) };
}

const sessChest = await ort.InferenceSession.create(root + '/public/models/onnx/meddef1_chest_xray.onnx');
const chestSamples = readdirSync(root + '/public/datasets/samples/chest_xray').filter(f => !f.startsWith('.'));
console.log('=== chest_xray (mean=0.4823, std=0.2216) ===');
for (const f of chestSamples) {
    const r = await inferImage(sessChest, root + '/public/datasets/samples/chest_xray/' + f,
        [0.48230693, 0.48230693, 0.48230693], [0.22157896, 0.22157896, 0.22157896],
        ['NORMAL', 'PNEUMONIA']);
    console.log(`  ${f.padEnd(40)} => ${r.pred} (${r.conf}%)`);
}

const sessTbcr = await ort.InferenceSession.create(root + '/public/models/onnx/vista_no_def_tbcr.onnx');
const tbcrSamples = readdirSync(root + '/public/datasets/samples/tbcr').filter(f => !f.startsWith('.'));
console.log('\n=== tbcr / VISTA (ultralytics: /255 only) ===');
for (const f of tbcrSamples) {
    const r = await inferImage(sessTbcr, root + '/public/datasets/samples/tbcr/' + f,
        [0, 0, 0], [1, 1, 1],
        ['Normal', 'Tuberculosis']);
    console.log(`  ${f.padEnd(40)} => ${r.pred} (${r.conf}%)`);
}

const sessRoct = await ort.InferenceSession.create(root + '/public/models/onnx/meddef1_roct.onnx');
const roctSamples = readdirSync(root + '/public/datasets/samples/roct').filter(f => !f.startsWith('.'));
console.log('\n=== roct (mean=0.1934, std=0.1934) ===');
for (const f of roctSamples) {
    const r = await inferImage(sessRoct, root + '/public/datasets/samples/roct/' + f,
        [0.19338988, 0.19338988, 0.19338988], [0.1933612, 0.1933612, 0.1933612],
        ['CNV', 'DME', 'DRUSEN', 'NORMAL']);
    console.log(`  ${f.padEnd(40)} => ${r.pred} (${r.conf}%)`);
}
// Verify downloaded PNEUMONIA candidates
console.log('\n=== PNEUMONIA candidate verification (local meddef1 model) ===');
const pneumoniaCandidates = [
    '/tmp/pneumonia_batch/person82_virus_155.jpeg',
    '/tmp/pneumonia_batch/person71_virus_131.jpeg',
];
for (const p of pneumoniaCandidates) {
    const r = await inferImage(sessChest, p,
        [0.48230693, 0.48230693, 0.48230693], [0.22157896, 0.22157896, 0.22157896],
        ['NORMAL', 'PNEUMONIA']);
    console.log(`  ${p.split('/').pop().padEnd(40)} => ${r.pred} (${r.conf}%)`);
}

// Verify TB candidate
console.log('\n=== TB candidate verification (local VISTA model) ===');
const tbCandidates = ['/tmp/Tuberculosis-263.png'];
for (const p of tbCandidates) {
    const r = await inferImage(sessTbcr, p, [0, 0, 0], [1, 1, 1], ['Normal', 'Tuberculosis']);
    console.log(`  ${p.split('/').pop().padEnd(40)} => ${r.pred} (${r.conf}%)`);
}