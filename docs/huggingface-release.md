# Hugging Face Model Release

The GitHub repository should stay small and reproducible. Host the model weight
in a Hugging Face model repository.

Recommended model repo:

```text
aayushale001/romax-card-designer-local
```

Recommended license:

```text
apache-2.0
```

This aligns the fine-tuned model weight with the Apache-2.0 license of the base
model, `HuggingFaceTB/SmolLM2-135M-Instruct`.

## Prepare the Upload Folder

From the project root:

```bash
npm run model:prepare-hf
```

By default, this creates:

```text
dist/huggingface-model/
  .gitattributes
  README.md
  card-designer-q4_k_m.gguf
  local-concept.schema.json
  model-comparison-data.json
```

If your GGUF is somewhere else:

```bash
MODEL_GGUF=/path/to/card-designer-q4_k_m.gguf npm run model:prepare-hf
```

## Upload With Git LFS

Install and authenticate once:

```bash
brew install git-lfs
git lfs install
huggingface-cli login
```

Create the model repo on Hugging Face, then push:

```bash
cd dist/huggingface-model
git init
git lfs install
git remote add origin https://huggingface.co/aayushale001/romax-card-designer-local
git add .
git commit -m "Add Romax card designer GGUF"
git push origin main
```

## App Configuration

After downloading the GGUF from Hugging Face, place it at:

```text
infra/pi/models/card-designer.gguf
```

Then run a local OpenAI-compatible server:

```bash
llama-server \
  -m infra/pi/models/card-designer.gguf \
  --alias card-designer-local \
  --host 127.0.0.1 \
  --port 8080 \
  -c 512 \
  -t 4 \
  -np 1
```

Use these environment values:

```env
AI_PROVIDER=local
LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1
LOCAL_LLM_MODEL=card-designer-local
LOCAL_LLM_CONCEPT_COUNT=4
LOCAL_LLM_MAX_TOKENS=430
```
