# Model Card: Romax Card Designer Local

## Summary

Romax Card Designer Local is a narrow, fine-tuned local language model for one
task:

```text
compact brand profile + card design direction/refinement -> one structured card concept JSON object
```

The model does not render cards, generate React, write arbitrary HTML/CSS, issue
wallet passes, or control application state. The Next.js app owns rendering,
brand locks, field limits, QR safety, wallet-ready JSON, and export behavior.

## Base Model

- Base model: `HuggingFaceTB/SmolLM2-135M-Instruct`
- Base model family: SmolLM2
- Base model size: 135M parameters
- Base model license: Apache-2.0
- Base model page: <https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct>

The base model card says SmolLM2 is an on-device-focused compact model family and
lists Apache-2.0 as the license.

## Fine-Tuning

- Method: LoRA supervised fine-tuning
- Training framework: `transformers`, `trl`, `peft`
- Training script: `training/train_lora.py`
- Training data: `training/data/card_design_v6_train.jsonl`
- Validation data: `training/data/card_design_v6_validation.jsonl`
- Held-out test data: `training/data/card_design_v6_test.jsonl`
- Epochs used for the current local V6 benchmark: 2
- Export path: merged model -> GGUF Q4_K_M via `llama.cpp`

The local application uses the quantized GGUF through an OpenAI-compatible
`llama-server` endpoint.

## Intended Use

Use this model inside Romax Pass AI when:

- A cloud model is unavailable.
- Offline/private generation is useful.
- You need predictable structured card-design intent, not broad general chat.
- You want a small edge-model demo for Raspberry Pi-class deployment research.

Expected output is a compact JSON object validated against
`config/local-concept.schema.json`.

## Out-of-Scope Use

This model is not intended for:

- General chatbot use
- Factual answers
- Legal, medical, financial, or safety-critical advice
- Direct HTML/CSS/React generation
- Real Apple Wallet `.pkpass` generation
- Identity verification or fraud prevention decisions

## Inputs

The model receives compact text such as:

```text
id=local-premium-2; brand=Slow Brew Club; industry=Coffee loyalty;
colors=#7c3f24,#f0c987; tone=warm,local,modern; assets=logo,background;
direction=Create a premium brand-immersive card with dominant color...
```

Refinement prompts include the current concept state and a short instruction.

## Output Schema

The model returns one concept object with:

- `id`
- `name`
- `description`
- `mood`
- `requiredFields`
- `designTokens`

The renderer interprets these tokens into a deterministic card layout.

## Evaluation

See `docs/model-comparison.md` and `docs/model-comparison-data.json`.

Current benchmark highlights:

- Local model: fine-tuned SmolLM2 135M Q4_K_M GGUF
- GGUF size: about 101 MiB
- Request success rate in a 40-example held-out local smoke evaluation: 100%
- Brand color preservation: 100%
- Locked field preservation: 100%
- Average evaluator score: 73.8%
- Artificial ARM64 Docker constraint: 0.5 CPU, 384 MiB memory, 512-token context

The benchmark is product-path oriented, not a general LLM benchmark.

## Limitations

- The model is highly specialized and brittle outside the card-design JSON task.
- It can over-select optional member fields.
- It is less nuanced than a larger cloud model for open-ended creative prompts.
- Under strict edge constraints it is much slower than the cloud model.
- It may produce malformed JSON unless used with schema-constrained decoding and
  app-side normalization.
- It inherits general small-model limitations from the base model, including
  possible inconsistency and bias.

## Safety and Guardrails

The application applies these controls after generation:

- Zod/schema validation
- Brand color repair
- Required `name`, `memberId`, and `qrCode` fields
- Field count limits
- Deterministic card layout
- QR-safe rendering
- Local fallback concepts when model output fails

## Model Weights

Do not commit model weights directly to normal Git.

Recommended hosting:

- Hugging Face model repository
- License: Apache-2.0 for the fine-tuned model weights, aligned with the base
  model
- File: `card-designer-q4_k_m.gguf`

Prepare a local Hugging Face upload folder with:

```bash
npm run model:prepare-hf
```

If the local GGUF exists at `infra/pi/models/card-designer.gguf`, the script
copies it into `dist/huggingface-model/card-designer-q4_k_m.gguf`.
