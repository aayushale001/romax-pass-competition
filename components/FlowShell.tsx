"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Stepper } from "@/components/Stepper";
import { flowSteps } from "@/lib/flowState";

type FlowShellProps = {
  currentStep: number;
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  actions?: ReactNode;
  narrow?: boolean;
};

export function FlowShell({
  currentStep,
  children,
  eyebrow = "Romax sponsor challenge",
  title = "AI Powered Digital Wallet Card Generator",
  actions,
  narrow,
}: FlowShellProps) {
  return (
    <main className="min-h-screen bg-[#f6f8fb] text-gray-950">
      <div
        className={`mx-auto grid gap-7 px-4 py-6 sm:px-6 lg:px-8 ${
          narrow ? "max-w-3xl" : "max-w-7xl"
        }`}
      >
        <header className="grid gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase text-gray-500">
                {eyebrow}
              </p>
              <h1 className="text-3xl font-bold leading-tight text-gray-950">
                {title}
              </h1>
            </div>
            {actions ? (
              <div className="flex flex-wrap gap-2">{actions}</div>
            ) : null}
          </div>
          <Stepper
            steps={flowSteps.map((step, index) => ({
              ...step,
              enabled: index <= currentStep,
            }))}
            currentStep={currentStep}
          />
        </header>
        {children}
        {currentStep > 0 ? (
          <footer className="border-t border-gray-200 pt-4">
            <Link
              href="/"
              className="text-sm font-semibold text-gray-600 transition hover:text-gray-950"
            >
              Start over with a different website
            </Link>
          </footer>
        ) : null}
      </div>
    </main>
  );
}
