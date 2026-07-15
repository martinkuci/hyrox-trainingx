"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PlanningShell } from "@/components/planning/PlanningShell";
import { StatusBadge } from "@/components/planning/StatusBadge";
import { useHyroxData } from "@/hooks/useHyroxData";
import type {
  NewScheduledWorkout,
  ScheduledWorkout,
  ScheduledWorkoutStatus,
  WeeklyPlanDay,
} from "@/lib/types";