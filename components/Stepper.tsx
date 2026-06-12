"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";

type Step = {
  label: string;
  href?: string;
  enabled?: boolean;
};

type StepperProps = {
  steps: Array<string | Step>;
  currentStep: number;
};

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <ol className="grid gap-2 sm:grid-cols-6">
      {steps.map((stepItem, index) => {
        const step =
          typeof stepItem === "string" ? { label: stepItem } : stepItem;
        const complete = index < currentStep;
        const active = index === currentStep;
        const content = (
          <>
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                complete
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-current"
              }`}
            >
              {complete ? <Check size={14} /> : <Circle size={10} />}
            </span>
            <span className="truncate font-medium">{step.label}</span>
          </>
        );

        return (
          <li
            key={step.label}
            className={`flex min-w-0 items-center gap-2 border-b-2 pb-2 text-sm ${
              active
                ? "border-gray-950 text-gray-950"
                : complete
                  ? "border-emerald-500 text-gray-900"
                  : "border-gray-200 text-gray-500"
            }`}
          >
            {step.href && step.enabled ? (
              <Link
                href={step.href}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
