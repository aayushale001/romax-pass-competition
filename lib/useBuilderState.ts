"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSelectedConcept,
  loadBuilderState,
  saveBuilderState,
  type PassBuilderState,
} from "@/lib/flowState";

type Requirement = "brand" | "concepts" | "concept";

function hasRequiredState(
  state: PassBuilderState | null,
  requirement: Requirement,
) {
  if (!state?.brandProfile) {
    return false;
  }

  if (requirement === "concepts") {
    return state.concepts.length > 0;
  }

  if (requirement === "concept") {
    return state.concepts.length > 0 && Boolean(getSelectedConcept(state));
  }

  return true;
}

function redirectForMissingState(
  state: PassBuilderState | null,
  requirement: Requirement,
) {
  if (!state?.brandProfile) {
    return "/";
  }

  if (requirement === "concepts" || requirement === "concept") {
    return state.concepts.length ? "/concepts" : "/brand";
  }

  return "/";
}

export function useBuilderState(requirement: Requirement = "brand") {
  const router = useRouter();
  const [state, setStateValue] = useState<PassBuilderState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedState = loadBuilderState();
    if (!hasRequiredState(storedState, requirement)) {
      router.replace(redirectForMissingState(storedState, requirement));
      return;
    }

    queueMicrotask(() => {
      setStateValue(storedState);
      setReady(true);
    });
  }, [requirement, router]);

  const selectedConcept = useMemo(() => getSelectedConcept(state), [state]);

  function setState(
    updater:
      | PassBuilderState
      | ((current: PassBuilderState) => PassBuilderState),
  ) {
    setStateValue((current) => {
      if (!current) {
        return current;
      }

      const nextState =
        typeof updater === "function" ? updater(current) : updater;
      saveBuilderState(nextState);
      return nextState;
    });
  }

  return {
    ready,
    state,
    selectedConcept,
    setState,
  };
}
