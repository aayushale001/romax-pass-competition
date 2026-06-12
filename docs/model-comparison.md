# Fine-Tuned Edge Model vs GPT-5.4 Mini

> Benchmark date: June 10, 2026
> Project: Romax Pass AI, an AI-assisted membership card generator

## Executive Summary

Romax Pass AI can generate card-design intent using either:

1. OpenAI's `gpt-5.4-mini` through the Responses API.
2. A fine-tuned SmolLM2 135M model running locally through `llama.cpp`.

In the measured product-path benchmark, GPT-5.4 mini generated eight concepts in
**8.86 seconds**. The local V6 model generated four concepts sequentially in a
deliberately constrained ARM64 Docker environment, then the deterministic design
engine filled the remaining four concepts. That path completed in **130.69
seconds**.

GPT-5.4 mini was **14.75x faster** under this artificial half-core constraint and
produced more nuanced design variation. The local model remained valuable for a
different reason: it ran fully offline from a **101 MB GGUF**, preserved every
hard brand constraint in the sample, and stayed healthy within a **384 MiB**
memory limit.

The result supports a hybrid architecture rather than a simple winner:

- Use GPT-5.4 mini when connectivity, speed, and creative interpretation matter.
- Use the local specialist model for offline operation, privacy, predictable
  structured output, and graceful cloud fallback.
- Keep rendering and hard safety rules deterministic in both modes.

## System Architecture

```mermaid
flowchart LR
    A["Brand profile and design brief"] --> B{"AI provider"}
    B -->|"Cloud mode"| C["GPT-5.4 mini<br/>Responses API"]
    B -->|"Edge mode"| D["Fine-tuned SmolLM2 135M<br/>Q4_K_M GGUF + llama.cpp"]
    C --> E["Structured card-design JSON"]
    D --> E
    E --> F["Schema validation and brand-lock repair"]
    F --> G["Deterministic card renderer"]
    G --> H["Live preview, PNG, and wallet-ready JSON"]
```

The models choose design intent such as mood, orientation, background treatment,
field selection, and asset usage. They do not control the renderer directly.
Brand colors, required identity fields, QR visibility, and layout safety remain
application-owned.

## Models Compared

| Property | GPT-5.4 mini | Fine-tuned local V6 |
|---|---:|---:|
| Runtime | OpenAI Responses API | `llama.cpp` in ARM64 Docker |
| Base model | GPT-5.4 mini | `HuggingFaceTB/SmolLM2-135M-Instruct` |
| Model size | Hosted | 101 MB Q4_K_M GGUF |
| Parameters | Hosted model, not reported here | 134,515,008 |
| Context used in test | Cloud-managed | 512 tokens |
| Output contract | Zod Structured Outputs | JSON Schema constrained decoding |
| AI concepts requested | 8 in one request | 4 sequential requests |
| Remaining concepts | None | 4 deterministic fallback concepts |
| Network required | Yes | No |
| Marginal API cost | Token-based | None |

OpenAI documents GPT-5.4 mini as a fast model for high-volume workloads with a
400,000-token context window, a 128,000-token maximum output, image input, and
Structured Outputs support:
[GPT-5.4 mini model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Local Training

The specialist model was trained with LoRA for two epochs on a combined V6
dataset:

| Split | Examples |
|---|---:|
| Training | 5,000 |
| Validation | 500 |
| Held-out test | 500 |

The dataset combines curated and independently authored design scenarios while
checking for duplicate prompts, split leakage, locked-field violations, and
token-budget violations.

Training selected epoch 2 as the best checkpoint:

| Metric | Epoch 1 | Epoch 2 |
|---|---:|---:|
| Validation loss | 0.2321 | **0.1980** |
| Mean token accuracy | 94.77% | **95.46%** |

The quantized local model also completed a 40-example held-out smoke evaluation:

| Metric | Local V6 Q4 |
|---|---:|
| Request success rate | 100% |
| Average evaluator score | 73.8% |
| Brand color preservation | 100% |
| Locked-field preservation | 100% |
| Exact optional-field match | 25% |
| Categorical design accuracy | 57.3% |

This shows the local model's current personality clearly: it is reliable on hard
constraints, but it still over-selects optional fields and is less precise on
nuanced art direction.

## Product-Path Benchmark

### Test Setup

Both paths received the same confirmed coffee-loyalty BrandProfile:

- Brand: Slow Brew Club
- Industry: Coffee loyalty
- Tone: warm, local, modern
- Primary color: `#7c3f24`
- Secondary color: `#f0c987`

The local model ran under the project's Raspberry Pi simulation:

| Constraint | Value |
|---|---:|
| Platform | Linux ARM64 Docker |
| CPU quota | 0.5 CPU |
| Memory limit | 384 MiB |
| Context | 512 tokens |
| Parallel slots | 1 |
| Local concepts | 4 |

This is intentionally harsh, but it is not a cycle-accurate Raspberry Pi
emulation. A Mac CPU limited to half a core still has a different architecture,
cache, and clock profile from a Raspberry Pi.

### Results

| Metric | GPT-5.4 mini | Local V6 under constraint |
|---|---:|---:|
| End-to-end generation time | **8.86 s** | 130.69 s |
| Relative speed | **14.75x faster** | Baseline |
| Returned concepts | 8 | 8 |
| Fully AI-generated concepts | 8 | 4 |
| Deterministic fallback concepts | 0 | 4 |
| Schema-valid response | Yes | Yes |
| Brand color preserved | Yes | Yes |
| Locked fields preserved | Yes | Yes |
| Unique moods across final set | 7 | 7 |
| Unique background modes | **4** | 3 |
| Unique asset treatments | **5** | 3 |
| Average fields per AI concept | **4.75** | 6.25 |
| Observed container memory after benchmark | N/A | 246 MiB / 384 MiB |
| Container OOM | N/A | No |

### Interpretation

GPT-5.4 mini was substantially better at turning the brief into concise,
distinct concepts. It selected fewer unnecessary fields and produced a wider
range of background and asset treatments.

The local model successfully produced the four intended specialist directions:
official, premium, identity, and creative. It also preserved the brand color,
name/member-ID/QR locks, and schema contract. Its main weaknesses were latency
under the artificial CPU limit and a tendency to include more fields than the
brief required.

## Cost Comparison

OpenAI's published standard pricing for GPT-5.4 mini is:

- Input: **$0.75 per 1M tokens**
- Cached input: **$0.075 per 1M tokens**
- Output: **$4.50 per 1M tokens**

Source: [OpenAI API pricing](https://openai.com/api/pricing/).

Based on an approximate 1,800 input tokens and 1,310 output tokens for the
measured request, one eight-concept generation is estimated at roughly
**$0.0072**, or about **$7.20 per 1,000 similar generations**. This is an
estimate because the current application does not persist the API usage object.

The local model has no per-request API charge, but it is not literally free. It
still requires hardware, electricity, deployment work, and maintenance.

## What Each Model Is Best At

### GPT-5.4 Mini

- Fast interactive generation
- More precise interpretation of natural-language briefs
- Greater concept and asset-treatment diversity
- Better handling of long or complex prompts
- Eight fully generated concepts in one request

### Fine-Tuned Local V6

- Fully offline operation
- No API dependency or per-request charge
- Small enough to experiment with on edge hardware
- Predictable specialist vocabulary
- Strong hard-constraint compliance
- Useful fallback when cloud access is unavailable

## Recommended Production Strategy

Use a hybrid router:

1. Generate with GPT-5.4 mini when the cloud is available and the user requests
   creative exploration.
2. Use the local model for offline generation, privacy-sensitive workflows, or
   cloud failure.
3. Apply direct deterministic patches for surgical commands such as "remove the
   background" instead of asking either model to regenerate the whole design.
4. Keep brand locks, field limits, QR safety, rendering, and export logic in
   application code.
5. On Raspberry Pi-class hardware, request one or two local concepts initially,
   stream progress, and generate additional concepts in the background.

The important lesson was not that the small model replaced GPT-5.4 mini. It was
that a 135M specialist model could own a useful, bounded part of the product
while the deterministic application handled everything that needed guarantees.

## Benchmark Limitations

- The product-path comparison uses one shared BrandProfile and one run per
  provider.
- GPT-5.4 mini generates eight concepts in one request; the local path makes four
  sequential requests and fills four slots deterministically.
- The 40-example held-out evaluator was run against the local model, not GPT-5.4
  mini, so its score is not presented as a head-to-head quality score.
- Docker CPU quotas test resource pressure but do not accurately emulate
  Raspberry Pi latency, thermals, SD-card speed, or throttling.
- Cloud latency and output can vary between requests.

The compact tracked benchmark summary is available in
[`docs/model-comparison-data.json`](model-comparison-data.json). More detailed
local artifacts are written to the ignored `training/reports/model-comparison/`
directory during development.

## LinkedIn-Ready Post

I fine-tuned a 135M-parameter model to generate structured membership-card
design concepts, then compared it with GPT-5.4 mini inside the same Next.js
product.

The local model was quantized into a 101 MB GGUF and tested in an ARM64 Docker
container limited to 0.5 CPU and 384 MiB RAM.

Results for the same coffee-loyalty brand brief:

- GPT-5.4 mini: 8 AI concepts in 8.86 seconds
- Local V6: 4 AI concepts plus 4 deterministic fallbacks in 130.69 seconds
- GPT-5.4 mini was 14.75x faster in the constrained test
- Both preserved the brand color and mandatory name/member-ID/QR fields
- The local container stayed healthy at roughly 246 MiB with no OOM
- Local held-out test: 100% request success and 73.8% average score

GPT-5.4 mini clearly won on speed, natural-language interpretation, and creative
variety. The tiny local model won on offline operation, privacy, predictable
specialist behavior, and zero per-request API cost.

My biggest takeaway: edge AI does not need to replace a frontier model to be
useful. A hybrid system can let the cloud model handle open-ended creativity,
let a small local model handle bounded specialist work, and keep critical safety
rules inside deterministic application code.

#EdgeAI #LLM #NextJS #RaspberryPi #OpenAI #FineTuning #MachineLearning
