# Raspberry Pi Zero 2 W Test Environment

This folder approximates the deployment environment before the real Pi is available.

It checks:

- Linux ARM64 compatibility.
- Whether `llama-server` plus the selected GGUF model stays under a strict memory cap.
- Whether the app can call an OpenAI-compatible local endpoint.
- Whether the model returns usable JSON.

It does **not** accurately predict Raspberry Pi latency, temperature, throttling, SD-card speed, or Wi-Fi behavior. An Apple Silicon Mac is dramatically faster than a 1GHz Cortex-A53.

## Fast Integration Test Without A Model

From the project root:

```bash
npm run local-ai:mock
```

In another terminal:

```bash
npm run local-ai:smoke
```

To test the Next.js app against the mock server:

```bash
AI_PROVIDER=local \
LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1 \
LOCAL_LLM_CONCEPT_COUNT=2 \
npm run dev
```

## ARM64 And Memory-Constrained Test

1. Start Docker Desktop.
2. Put a small GGUF file at:

```text
infra/pi/models/card-designer.gguf
```

For the released model, download `card-designer-q4_k_m.gguf` from the Hugging
Face model repository and either rename it to `card-designer.gguf` or update
`infra/pi/compose.yaml` to point at the downloaded filename.

3. Start the constrained server:

```bash
docker compose -f infra/pi/compose.yaml up
```

4. Run:

```bash
npm run local-ai:smoke
```

The container uses:

- `linux/arm64`
- A 0.5 CPU stress-test quota
- 384MB memory limit
- 512-token context
- One parallel request
- Small batch sizes

The half-core quota is intentionally harsher than the original four-core
configuration. It makes latency and timeout risks visible on a fast development
Mac, but it still does not accurately emulate Raspberry Pi CPU performance.

The local integration sends llama.cpp a JSON Schema so the 135M model cannot
recursively invent nested objects. With the 512-token context, keep
`LOCAL_LLM_MAX_TOKENS=430` and use compact prompts. If a response reports
`finish_reason: length`, restart `llama-server` with `-c 1024` before increasing
the output-token limit.

If the container is killed for exceeding memory, try a smaller quantization or model before changing the memory cap.

## Recommended First Models

Start with a quantized SmolLM2 135M Instruct GGUF. Only try 360M after the 135M model is stable under the memory cap.

For the real Pi, use a 64-bit Raspberry Pi OS Lite image and build or install `llama.cpp` directly. Docker is useful for pre-hardware testing, but it adds overhead that the final Pi deployment should avoid.

Keep the local model server on a trusted LAN. Do not expose an unauthenticated `llama-server` port directly to the public internet.
