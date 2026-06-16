import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.resolve(
  process.env.HF_MODEL_DIR ?? "dist/huggingface-model",
);
const ggufSource = path.resolve(
  process.env.MODEL_GGUF ?? "infra/pi/models/card-designer.gguf",
);
const repoId = process.env.HF_MODEL_REPO ?? "aayushale00/romax-card-designer-local";

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source, target, required = true) {
  if (!(await exists(source))) {
    if (required) {
      throw new Error(`Missing required file: ${source}`);
    }
    return false;
  }

  await copyFile(source, target);
  return true;
}

await mkdir(outputDir, { recursive: true });

await copyIfExists(
  path.join(root, "huggingface", "README.md"),
  path.join(outputDir, "README.md"),
);
await copyIfExists(
  path.join(root, "huggingface", ".gitattributes"),
  path.join(outputDir, ".gitattributes"),
);
await copyIfExists(
  path.join(root, "config", "local-concept.schema.json"),
  path.join(outputDir, "local-concept.schema.json"),
);
await copyIfExists(
  path.join(root, "docs", "model-comparison-data.json"),
  path.join(outputDir, "model-comparison-data.json"),
);

const copiedModel = await copyIfExists(
  ggufSource,
  path.join(outputDir, "card-designer-q4_k_m.gguf"),
  false,
);

await writeFile(
  path.join(outputDir, "UPLOAD.md"),
  `# Upload Romax Card Designer Local

This folder is prepared for the Hugging Face model repository:

\`\`\`text
${repoId}
\`\`\`

## Upload With Git LFS

\`\`\`bash
git init
git lfs install
git remote add origin https://huggingface.co/${repoId}
git add .
git commit -m "Add Romax card designer GGUF"
git push origin main
\`\`\`

## Files

- README.md
- .gitattributes
- local-concept.schema.json
- model-comparison-data.json
${copiedModel ? "- card-designer-q4_k_m.gguf\n" : ""}
${copiedModel ? "" : "\nThe GGUF was not copied because MODEL_GGUF was not found. Set MODEL_GGUF=/path/to/model.gguf and rerun `npm run model:prepare-hf`.\n"}
`,
);

console.log(`Prepared Hugging Face model folder: ${outputDir}`);
console.log(`Target model repo: ${repoId}`);
console.log(
  copiedModel
    ? "Copied GGUF model weight."
    : "No GGUF copied. Set MODEL_GGUF or place the file at infra/pi/models/card-designer.gguf.",
);
