# Specialist Card-Design Model Training

The local model has one narrow responsibility:

```text
compact brand + design direction/refinement -> one valid card concept JSON object
```

The application owns rendering, brand locks, field limits, QR safety, and
exports. Train on a Mac or cloud GPU; use Raspberry Pi-class hardware only for
quantized inference.

## Current Dataset

V6 combines two independently maintained scenario curricula:

- Curated V4: compact runtime-style instructions.
- Scenario V5: longer design and refinement briefs with scenario-aware brand
  matching.

The combined dataset keeps brand and scenario boundaries isolated across
training, validation, and final-test splits.

| Split | Examples |
|---|---:|
| Training | 5,000 |
| Validation | 500 |
| Final test | 500 |

## Generate Data

```bash
npm run training:data:v4
npm run training:data:scenario-v5
npm run training:data:v6
```

The builders validate:

- Exact split sizes and source balance
- Unique prompts and expected IDs
- Brand and scenario isolation across splits
- Required `name`, `memberId`, and `qrCode` fields
- Primary-color preservation
- Photo and decorative-art flag consistency
- Compatibility with `config/local-concept.schema.json`
- A 640-token maximum example length

Generated files:

```text
training/data/card_design_v4_*
training/data/card_design_scenario_v5_*
training/data/card_design_v6_*
```

## Train

Create the environment once:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r training/requirements.txt
```

Train V6 for two epochs:

```bash
npm run training:train:v6
```

The trainer evaluates after every epoch, restores the checkpoint with the
lowest validation loss, saves the adapter, and writes a merged model to:

```text
training/output/card-designer-v6-combined-lora-merged
```

## Export GGUF

Set `LLAMA_CPP_DIR` to a llama.cpp source checkout containing
`convert_hf_to_gguf.py`, then run:

```bash
PYTHON_BIN=.venv/bin/python bash training/export_gguf.sh
```

The default output is:

```text
training/output/gguf-v6/card-designer-f16.gguf
training/output/gguf-v6/card-designer-q4_k_m.gguf
```

Model binaries and training outputs are intentionally ignored by Git.

## Evaluate

Start the quantized model with `llama-server`, then run:

```bash
npm run local-ai:smoke

npm run training:evaluate:v6 -- \
  --limit=500 \
  --output=training/reports/card-designer-v6-final-test.json
```

Use validation results for checkpoint and training decisions. Run the final
test only when the candidate is finished so it remains an unbiased estimate.

## Edge Simulation

See `infra/pi/README.md` for the ARM64 Docker stress test. It checks memory,
schema-constrained output, and application integration, but it does not
accurately emulate Raspberry Pi latency, thermals, storage, or throttling.
