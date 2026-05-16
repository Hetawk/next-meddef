/** Canonical production origin (no trailing slash). Override via NEXT_PUBLIC_URL for local dev. */
export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_URL ?? "https://meddef.ekddigital.com"
).replace(/\/+$/, "");

export const APP = {
  name: "MedDef",
  title:
    "MedDef: An Attention Based Model For Adversarial Resilience in Medical Imaging",
  author: "Enoch Kwateh Dongbo",
  authorZh: "东博",
  studentId: "202324100003",
  emailStudent: "enoch.dongbo@stu.ujn.edu.cn",
  emailPersonal: "ekd@ekddigital.com",
  phone: "+86 185 0683 2159",
  supervisor: "Niu Sijie",
  supervisorZh: "牛四杰",
  modelsDir: process.env.NEXT_PUBLIC_MODELS_DIR ?? "/models/onnx",
  datasetsDir: process.env.NEXT_PUBLIC_DATASETS_DIR ?? "/datasets",
} as const;
