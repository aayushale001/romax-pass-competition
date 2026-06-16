---
license: apache-2.0
base_model: HuggingFaceTB/SmolLM2-135M-Instruct
library_name: llama.cpp
pipeline_tag: text-generation
language:
  - en
tags:
  - gguf
  - smollm2
  - local-llm
  - structured-output
  - membership-card
  - card-design
datasets:
  - custom
model-index:
  - name: Romax Card Designer Local
    results: []
---

# Romax Card Designer Local

Romax Card Designer Local is a fine-tuned SmolLM2 135M specialist model for
generating compact membership-card design intent as structured JSON.

It is designed for the Romax Pass AI application. The model chooses design
intent such as mood, orientation, brand asset treatment, field choice, and color
usage. The application owns rendering, QR safety, brand locks, field limits, PNG
export, and wallet-ready JSON.

## Files

| File | Purpose |
|---|---|
| `card-designer-q4_k_m.gguf` | Quantized local model for `llama.cpp` |
| `local-concept.schema.json` | JSON Schema expected by the app/local server |
| `model-comparison-data.json` | Compact benchmark summary |

## Base Model

- Base model: [`HuggingFaceTB/SmolLM2-135M-Instruct`](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct)
- Base model license: Apache-2.0
- Fine-tuned model license: Apache-2.0
- Format: GGUF Q4_K_M
- Approximate GGUF size: 101 MiB

## Intended Use

Use this model as an OpenAI-compatible local endpoint for Romax Pass AI:

```bash
llama-server \
  -m card-designer-q4_k_m.gguf \
  --alias card-designer-local \
  --host 127.0.0.1 \
  --port 8080 \
  -c 512 \
  -t 4 \
  -np 1
```

Then configure the app:

```env
AI_PROVIDER=local
LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1
LOCAL_LLM_MODEL=card-designer-local
LOCAL_LLM_CONCEPT_COUNT=4
LOCAL_LLM_MAX_TOKENS=430
```

## Output Contract

The model should return one compact JSON object:

```json
{
  "id": "local-premium-2",
  "name": "Premium Wallet Pass",
  "description": "A brand-immersive card concept.",
  "mood": "premium",
  "requiredFields": ["name", "memberId", "tier", "qrCode"],
  "designTokens": {
    "primaryColor": "#7c3f24",
    "secondaryColor": "#f0c987",
    "textColor": "#ffffff",
    "orientation": "portrait",
    "backgroundMode": "gradient",
    "colorUsage": "full",
    "brandAssetSource": "logo",
    "brandAssetTreatment": "background-emblem",
    "brandAssetIntensity": "medium",
    "usesLogo": true,
    "usesQr": true,
    "usesPhoto": false,
    "usesDecorativeArt": false
  }
}
```

The app validates output against `local-concept.schema.json` and repairs hard
brand constraints before rendering.

## Training

- Method: LoRA supervised fine-tuning
- Base model: `HuggingFaceTB/SmolLM2-135M-Instruct`
- Training data: Romax Card Design V6 synthetic dataset
- Training examples: 5,000
- Validation examples: 500
- Held-out final test examples: 500
- Training code: see the GitHub repository linked from this model card

## Evaluation

Measured local V6 Q4 benchmark highlights:

| Metric | Value |
|---|---:|
| Request success rate | 100% |
| Average evaluator score | 73.8% |
| Brand color preservation | 100% |
| Locked-field preservation | 100% |
| Exact optional-field match | 25% |
| Categorical design accuracy | 57.3% |

In a product-path benchmark, GPT-5.4 mini generated eight concepts in 8.86s.
The local model generated four concepts sequentially under a strict ARM64 Docker
constraint and the deterministic app filled four fallback concepts; that path
completed in 130.69s.

## Limitations

- Specialized for Romax Pass AI concept JSON only.
- Not a general chatbot.
- Can over-select optional fields.
- Less nuanced than larger cloud models for open-ended creative prompts.
- Needs schema-constrained decoding plus app-side validation.
- Inherits small-model limitations from SmolLM2, including possible
  inconsistency and bias.

## GitHub

Source code, training data, training scripts, and documentation are available in
the project repository.
