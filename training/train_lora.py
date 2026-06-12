import argparse
import math

import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoTokenizer
from trl import SFTConfig, SFTTrainer


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="HuggingFaceTB/SmolLM2-135M-Instruct")
    parser.add_argument("--data", default="training/data/card_design_v6_train.jsonl")
    parser.add_argument("--eval-data", default="training/data/card_design_v6_validation.jsonl")
    parser.add_argument("--output", default="training/output/card-designer-v6-combined-lora")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--gradient-accumulation", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--max-length", type=int, default=640)
    parser.add_argument("--max-steps", type=int, default=-1)
    parser.add_argument("--skip-eval", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    train_dataset = load_dataset("json", data_files=args.data, split="train")
    eval_dataset = None
    if not args.skip_eval:
        eval_dataset = load_dataset("json", data_files=args.eval_data, split="train")

    def prompt_completion(example):
        messages = example["messages"]
        prompt = tokenizer.apply_chat_template(
            messages[:-1],
            tokenize=False,
            add_generation_prompt=True,
        )
        return {
            "prompt": prompt,
            "completion": messages[-1]["content"] + tokenizer.eos_token,
        }

    train_dataset = train_dataset.map(
        prompt_completion,
        remove_columns=train_dataset.column_names,
    )
    if eval_dataset is not None:
        eval_dataset = eval_dataset.map(
            prompt_completion,
            remove_columns=eval_dataset.column_names,
        )

    estimated_steps = args.max_steps
    if estimated_steps < 0:
        batches_per_epoch = math.ceil(len(train_dataset) / args.batch_size)
        estimated_steps = math.ceil(
            batches_per_epoch / args.gradient_accumulation
        ) * math.ceil(args.epochs)
    warmup_steps = max(1, round(estimated_steps * 0.08))

    peft_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    )

    config = SFTConfig(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        warmup_steps=warmup_steps,
        weight_decay=0.01,
        logging_steps=5,
        logging_first_step=True,
        save_strategy="epoch",
        eval_strategy="epoch" if eval_dataset is not None else "no",
        load_best_model_at_end=eval_dataset is not None,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        save_total_limit=2,
        report_to="none",
        max_length=args.max_length,
        completion_only_loss=True,
        gradient_checkpointing=False,
        # MPS does not provide a supported flash-attention implementation for
        # packed/padding-free training, so keep examples isolated.
        packing=False,
        padding_free=False,
        dataloader_pin_memory=torch.cuda.is_available(),
        fp16=torch.cuda.is_available(),
    )

    trainer = SFTTrainer(
        model=args.model,
        args=config,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        processing_class=tokenizer,
        peft_config=peft_config,
    )
    trainer.train()
    trainer.save_model(args.output)

    merged_output = f"{args.output}-merged"
    merged_model = trainer.model.merge_and_unload()
    merged_model.save_pretrained(merged_output, safe_serialization=True)
    tokenizer.save_pretrained(merged_output)
    print(f"Saved merged model to {merged_output}")


if __name__ == "__main__":
    main()
