#!/usr/bin/env bash
set -euo pipefail

LLAMA_CPP_DIR="${LLAMA_CPP_DIR:-.tools/llama.cpp}"
MODEL_DIR="${1:-training/output/card-designer-v6-combined-lora-merged}"
OUTPUT_DIR="${2:-training/output/gguf-v6}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [[ ! -f "$LLAMA_CPP_DIR/convert_hf_to_gguf.py" ]]; then
  echo "Missing $LLAMA_CPP_DIR/convert_hf_to_gguf.py" >&2
  echo "LLAMA_CPP_DIR must point to a llama.cpp source checkout, not a placeholder or Homebrew prefix." >&2
  exit 1
fi

if [[ -x "$LLAMA_CPP_DIR/build/bin/llama-quantize" ]]; then
  QUANTIZE_BIN="$LLAMA_CPP_DIR/build/bin/llama-quantize"
elif command -v llama-quantize >/dev/null 2>&1; then
  QUANTIZE_BIN="$(command -v llama-quantize)"
else
  echo "Could not find llama-quantize. Build llama.cpp or install it with Homebrew." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

"$PYTHON_BIN" "$LLAMA_CPP_DIR/convert_hf_to_gguf.py" "$MODEL_DIR" \
  --outfile "$OUTPUT_DIR/card-designer-f16.gguf" \
  --outtype f16

"$QUANTIZE_BIN" \
  "$OUTPUT_DIR/card-designer-f16.gguf" \
  "$OUTPUT_DIR/card-designer-q4_k_m.gguf" \
  Q4_K_M

echo "Created $OUTPUT_DIR/card-designer-q4_k_m.gguf"
