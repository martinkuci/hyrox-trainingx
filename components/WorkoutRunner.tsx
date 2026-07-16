"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StepSplit, WorkoutTemplate } from "@/lib/types";
import ConfirmDialog from "@/components/ConfirmDialog";
import WorkoutResultForm from "@/components/WorkoutResultForm";

type RunnableStep = {
  blockId: string;
  stepId: string;
  blockTitle: string;
  round: number;
  roundCount: number;
  name: string;
  detail: string;
  durationSeconds?: number;