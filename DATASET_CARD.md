# Dataset Card: Romax Card Design V6

## Summary

Romax Card Design V6 is a synthetic supervised fine-tuning dataset for a narrow
structured-output task:

```text
compact brand + design direction/refinement -> one card concept JSON object
```

It is designed for training a small local model to produce card-design intent
for the Romax Pass AI renderer. It is not a general design, branding, or natural
language dataset.

## Files

The tracked datasets are under `training/data/`.

| File group | Purpose |
|---|---|
| `card_design_v4_*` | Curated compact runtime-style examples |
| `card_design_scenario_v5_*` | Longer scenario/refinement examples |
| `card_design_v6_*` | Balanced combined dataset used for local V6 training |

Primary training split:

| Split | Examples |
|---|---:|
| Train | 5,000 |
| Validation | 500 |
| Final test | 500 |

## Schema

Each JSONL row contains:

- `messages`: chat-style system/user/assistant messages
- `metadata`: validation and evaluation metadata

The assistant message contains the target structured card concept.

The model output contract is defined in:

```text
config/local-concept.schema.json
```

## How the Dataset Was Built

The dataset is generated locally by deterministic scripts:

```bash
npm run training:data:v4
npm run training:data:scenario-v5
npm run training:data:v6
```

Source files:

- `training/v4_scenario_library.mjs`
- `training/scenario_v5_library.mjs`
- `training/build_v4_dataset.mjs`
- `training/build_scenario_v5_dataset.mjs`
- `training/build_v6_combined_dataset.mjs`

The builders validate:

- Split sizes
- Balanced source composition
- Unique prompts
- Unique expected IDs
- Brand isolation across splits
- Scenario isolation across splits
- Required locked fields: `name`, `memberId`, `qrCode`
- Primary color preservation
- Photo/decorative-art flag consistency
- Token budget compatibility
- JSON Schema compatibility

## Data Source

The dataset is synthetic and project-authored. It uses fictional brands,
industries, tones, colors, card directions, and refinement prompts.

It does not contain:

- Real member personal data
- Real customer records
- API keys
- Uploaded user photos
- Scraped website HTML
- Scraped website images

## Intended Use

Use this dataset to train or evaluate a small specialist model for Romax Pass AI
card concept generation.

## Out-of-Scope Use

This dataset should not be used for:

- General chatbot training
- Legal, medical, financial, or safety-critical systems
- Identity verification
- Production fraud detection
- Training a model to generate real wallet passes

## Known Limitations

- Synthetic examples may not represent all real brand edge cases.
- Generated concepts are tied to the current renderer vocabulary.
- The dataset intentionally favors structured output compliance over broad
  creativity.
- Some fictional brand names may coincidentally resemble real-world names.
- The local model trained on this data can still over-select optional fields.

## License

The dataset files in this repository are released under the repository MIT
license unless a future dataset release states otherwise.
