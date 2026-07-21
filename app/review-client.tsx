"use client";

import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  FlaskConical,
  GripVertical,
  Lightbulb,
  ListFilter,
  MoreHorizontal,
  MoveRight,
  Network,
  Pin,
  Plus,
  Search,
  Settings2,
  Target,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import OutcomeProgress from "@/app/outcome-progress";
import type { CSSProperties, DragEvent } from "react";
import type {
  AssumptionType,
  ReviewAssumption,
  ReviewSolution,
  ReviewState,
  ReviewTest,
  ReviewTreeNode,
  SolutionStatus,
  TestStatus,
  Verdict,
} from "@/lib/review-data";

type AddKind = "opportunity" | "solution" | "assumption" | "test";
type TreeNodeType = ReviewTreeNode["type"];
type InlineAddLocation = "tree" | "queue" | "detail";

type InlineAddTarget = {
  key: string;
  kind: AddKind;
  location: InlineAddLocation;
  anchorId: string;
  actionId?: string;
  actionLabel?: string;
  parentId?: string;
  depth?: number;
  solutionId?: string;
  assumptionId?: string;
};

type TreeAddAction = {
  id: string;
  label: string;
  helper: string;
  group: "alongside" | "inside";
  kind: AddKind;
  parentId?: string;
  solutionId?: string;
  assumptionId?: string;
  disabledReason?: string;
};

type TreeEditTarget = {
  key: string;
  nodeId: string;
  depth: number;
};

type DragPlacement = "before" | "after";

type TreeDragState = {
  nodeId: string;
  targetId: string | null;
  placement: DragPlacement | null;
};

type DeleteConfirmTarget = {
  nodeId: string;
  itemLabel: string;
  nestedCount: number;
};

type TestDraft = {
  assumptionNodeId: string;
  assumptionTitle: string;
  assumptionType: AssumptionType;
  owner: string;
  ownerRole: string;
  dueDate: string;
  status: TestStatus;
  testDescription: string;
  successCriteria: string;
  progressNotes: string;
  verdict: Verdict;
  evidence: string;
};

type AddDraft = {
  title: string;
  description: string;
  parentId: string;
  solutionId: string;
  assumptionId: string;
  assumptionType: AssumptionType;
  testDescription: string;
  successCriteria: string;
  owner: string;
  dueDate: string;
};

type TreeEditDraft = {
  title: string;
  description: string;
  assumptionType: AssumptionType;
};

type ParsedItem = {
  id: string;
  include: boolean;
  kind: AddKind;
  title: string;
  description: string;
  solutionName: string;
  assumptionTitle: string;
  assumptionType: AssumptionType;
  successCriteria: string;
  owner: string;
  dueDate: string;
};

type TeamDraft = {
  name: string;
  role: string;
};

type CreatedOpportunity = {
  id: string;
  parentId: string | null;
  outcomeId: string;
  title: string;
  description: string;
  reviewPriority: number;
};

const avatarFallbacks = ["DC", "SR", "AI", "+1"];

const typeMeta: Record<
  AssumptionType,
  { label: string; textClass: string; bgClass: string }
> = {
  desirability: {
    label: "Desirability",
    textClass: "type-desirability",
    bgClass: "type-desirability-bg",
  },
  feasibility: {
    label: "Feasibility",
    textClass: "type-feasibility",
    bgClass: "type-feasibility-bg",
  },
  usability: {
    label: "Usability",
    textClass: "type-usability",
    bgClass: "type-usability-bg",
  },
  viability: {
    label: "Viability",
    textClass: "type-viability",
    bgClass: "type-viability-bg",
  },
  ethical: {
    label: "Ethical",
    textClass: "type-ethical",
    bgClass: "type-ethical-bg",
  },
};

const statusMeta: Record<
  TestStatus,
  { label: string; textClass: string; bgClass: string; dotClass: string }
> = {
  not_started: {
    label: "Not started",
    textClass: "status-not-started",
    bgClass: "status-not-started-bg",
    dotClass: "dot-not-started",
  },
  in_progress: {
    label: "In progress",
    textClass: "status-in-progress",
    bgClass: "status-in-progress-bg",
    dotClass: "dot-in-progress",
  },
  done: {
    label: "Done",
    textClass: "status-done",
    bgClass: "status-done-bg",
    dotClass: "dot-done",
  },
};

const treeTypeLabels: Record<TreeNodeType, string> = {
  outcome: "Outcome",
  opportunity: "Opportunity",
  solution: "Solution",
  assumption: "Assumption",
};

const treeTypeMeta: Record<
  TreeNodeType,
  { label: string; icon: typeof Target }
> = {
  outcome: { label: "Outcome", icon: Target },
  opportunity: { label: "Opportunity", icon: Search },
  solution: { label: "Solution", icon: Lightbulb },
  assumption: { label: "Assumption", icon: FlaskConical },
};

function draftFromTest(test: ReviewTest): TestDraft {
  return {
    assumptionNodeId: test.assumptionNodeId,
    assumptionTitle: test.assumption,
    assumptionType: test.assumptionType,
    owner: test.owner,
    ownerRole: test.role,
    dueDate: test.dueDate,
    status: test.status,
    testDescription: test.test,
    successCriteria: test.successCriteria,
    progressNotes: test.progress,
    verdict: test.verdict,
    evidence: test.evidence,
  };
}

function makeEmptyAddDraft(
  review: ReviewState,
  overrides?: Partial<AddDraft>,
): AddDraft {
  return {
    title: "",
    description: "",
    parentId: "",
    solutionId: review.solutions[0]?.id ?? "",
    assumptionId: review.assumptions[0]?.id ?? "",
    assumptionType: "desirability",
    testDescription: "",
    successCriteria: "",
    owner: "",
    dueDate: "",
    ...overrides,
  };
}

function draftFromTreeNode(node: ReviewTreeNode): TreeEditDraft {
  return {
    title: node.title,
    description: node.description,
    assumptionType: node.assumptionType ?? "desirability",
  };
}

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "NA";
  }

  return trimmed
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleForOwner(review: ReviewState, ownerName: string) {
  const normalized = ownerName.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return (
    review.teamMembers.find(
      (member) => member.name.trim().toLowerCase() === normalized,
    )?.role ?? ""
  );
}

function formatDueDate(dueDate: string) {
  if (!dueDate) {
    return "TBD";
  }

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return dueDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function isOverdue(dueDate: string, status: TestStatus) {
  if (!dueDate || status === "done") {
    return false;
  }

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return parsed.getTime() < normalizedToday.getTime();
}

function buildSiblingLabel(siblingTests: ReviewTest[], selectedTestId: string) {
  if (siblingTests.length <= 1) {
    return "Only test on this assumption";
  }

  const position = siblingTests.findIndex((test) => test.id === selectedTestId) + 1;
  return `Test ${position} of ${siblingTests.length} on this assumption`;
}

function bestNameMatch<T extends { id: string }>(
  items: T[],
  label: string,
  getText: (item: T) => string,
) {
  const needle = label.trim().toLowerCase();
  if (!needle) {
    return null;
  }

  return (
    items.find((item) => getText(item).trim().toLowerCase() === needle) ??
    items.find((item) => getText(item).trim().toLowerCase().includes(needle)) ??
    items.find((item) => needle.includes(getText(item).trim().toLowerCase())) ??
    null
  );
}

function parseAssumptionType(source: string): {
  cleaned: string;
  assumptionType: AssumptionType;
} {
  const typeMatch = source.match(
    /\b(desirability|feasibility|usability|viability|ethical)\b/i,
  );

  return {
    cleaned: source
      .replace(/\b(desirability|feasibility|usability|viability|ethical)\b/gi, "")
      .replace(/^[\s:()[\]-]+|[\s:()[\]-]+$/g, "")
      .trim(),
    assumptionType: (typeMatch?.[1]?.toLowerCase() as AssumptionType) ?? "desirability",
  };
}

function parseBrainstorm(text: string, fallbackKind: AddKind = "assumption"): ParsedItem[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedItem[] = [];
  let currentSolutionName = "";
  let currentAssumptionTitle = "";

  lines.forEach((line, index) => {
    const normalized = line.replace(/^[*-]\s*/, "");
    const lower = normalized.toLowerCase();

    let kind: AddKind = fallbackKind;
    let title = normalized;
    const description = "";
    let solutionName = currentSolutionName;
    let assumptionTitle = currentAssumptionTitle;
    let assumptionType: AssumptionType = "desirability";
    let successCriteria = "";
    let owner = "";
    let dueDate = "";

    const splitOnce = (value: string) => {
      const match = value.match(/^[^:-]+[:\-]\s*(.+)$/);
      return match?.[1]?.trim() ?? value.trim();
    };

    if (/^(opportunity|opp)\b/i.test(lower)) {
      kind = "opportunity";
      title = splitOnce(normalized);
    } else if (/^solution\b/i.test(lower)) {
      kind = "solution";
      title = splitOnce(normalized);
      currentSolutionName = title;
      solutionName = title;
      currentAssumptionTitle = "";
    } else if (/^(assumption|belief|risk)\b/i.test(lower)) {
      kind = "assumption";
      const parsedType = parseAssumptionType(splitOnce(normalized));
      title = parsedType.cleaned;
      assumptionType = parsedType.assumptionType;
      currentAssumptionTitle = title;
      assumptionTitle = title;
    } else if (
      /^(test|experiment|prototype|interview|survey|a\/b test|ab test)\b/i.test(lower)
    ) {
      kind = "test";
      title = splitOnce(normalized);
    } else if (fallbackKind === "assumption") {
      const parsedType = parseAssumptionType(normalized);
      title = parsedType.cleaned;
      assumptionType = parsedType.assumptionType;
      currentAssumptionTitle = title;
      assumptionTitle = title;
    } else {
      title = normalized;
    }

    const criteriaMatch = title.match(/\((?:success|criteria|validate)\s*[:\-]\s*([^)]+)\)/i);
    if (criteriaMatch) {
      successCriteria = criteriaMatch[1].trim();
      title = title.replace(criteriaMatch[0], "").trim();
    }

    const ownerMatch = title.match(/\bowner\s*[:\-]\s*([^|]+)$/i);
    if (ownerMatch) {
      owner = ownerMatch[1].trim();
      title = title.replace(ownerMatch[0], "").trim();
    }

    const dueMatch = title.match(/\bdue\s*[:\-]\s*([^|]+)$/i);
    if (dueMatch) {
      dueDate = dueMatch[1].trim();
      title = title.replace(dueMatch[0], "").trim();
    }

    if (kind === "test") {
      const parts = title.split("|").map((part) => part.trim()).filter(Boolean);
      title = parts[0] ?? title;

      parts.slice(1).forEach((part) => {
        if (/^assumption\b/i.test(part)) {
          assumptionTitle = splitOnce(part);
        } else if (/^solution\b/i.test(part)) {
          solutionName = splitOnce(part);
        } else if (/^(criteria|success)\b/i.test(part)) {
          successCriteria = splitOnce(part);
        } else if (/^owner\b/i.test(part)) {
          owner = splitOnce(part);
        } else if (/^due\b/i.test(part)) {
          dueDate = splitOnce(part);
        }
      });

      if (!assumptionTitle) {
        assumptionTitle = currentAssumptionTitle;
      }
    }

    if (!title) {
      return;
    }

    parsed.push({
      id: `parsed-${index}`,
      include: true,
      kind,
      title,
      description,
      solutionName,
      assumptionTitle,
      assumptionType,
      successCriteria,
      owner,
      dueDate,
    });
  });

  return parsed;
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function shortNameFromTitle(title: string) {
  return title.trim().split(/\s+/).slice(0, 2).join(" ");
}

function compareRankable<T extends { id: string; rank: number; reviewPriority: number }>(
  left: T,
  right: T,
) {
  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  if (left.reviewPriority !== right.reviewPriority) {
    return left.reviewPriority - right.reviewPriority;
  }

  return left.id.localeCompare(right.id);
}

function nextSiblingOpportunityLabel(label?: string) {
  const currentCount = Number(label?.match(/^\+(\d+)/)?.[1] ?? 0);
  const nextCount = currentCount + 1;
  const noun = nextCount === 1 ? "sibling opportunity" : "sibling opportunities";

  return `+${nextCount} ${noun} · collapsed`;
}

function normalizeReviewState(review: ReviewState): ReviewState {
  const solutions = [...review.solutions]
    .sort(compareRankable)
    .map((solution, index) => ({
      ...solution,
      rank: index + 1,
      shortName: solution.shortName || shortNameFromTitle(solution.name),
      status: solution.status ?? "active",
    }));

  const solutionMap = new Map(solutions.map((solution) => [solution.id, solution]));
  const solutionRankMap = new Map(
    solutions.map((solution) => [solution.id, solution.rank]),
  );

  const assumptions = [...review.assumptions]
    .filter((assumption) => solutionMap.has(assumption.solutionId))
    .map((assumption) => ({
      ...assumption,
      solutionName:
        solutionMap.get(assumption.solutionId)?.name ?? assumption.solutionName,
    }))
    .sort((left, right) => {
      const leftSolutionRank = solutionRankMap.get(left.solutionId) ?? 999;
      const rightSolutionRank = solutionRankMap.get(right.solutionId) ?? 999;

      if (leftSolutionRank !== rightSolutionRank) {
        return leftSolutionRank - rightSolutionRank;
      }

      return compareRankable(left, right);
    })
    .map((assumption, index) => ({ ...assumption, rank: index + 1 }));

  const assumptionMap = new Map(
    assumptions.map((assumption) => [assumption.id, assumption]),
  );
  const assumptionRankMap = new Map(
    assumptions.map((assumption) => [assumption.id, assumption.rank]),
  );

  const tests = [...review.tests]
    .filter(
      (test) =>
        solutionMap.has(test.solutionId) && assumptionMap.has(test.assumptionNodeId),
    )
    .map((test) => {
      const assumption = assumptionMap.get(test.assumptionNodeId);
      const solution = solutionMap.get(test.solutionId);

      return {
        ...test,
        solutionName: solution?.name ?? test.solutionName,
        assumption: assumption?.title ?? test.assumption,
        assumptionType: assumption?.assumptionType ?? test.assumptionType,
      };
    })
    .sort((left, right) => {
      const leftSolutionRank = solutionRankMap.get(left.solutionId) ?? 999;
      const rightSolutionRank = solutionRankMap.get(right.solutionId) ?? 999;

      if (leftSolutionRank !== rightSolutionRank) {
        return leftSolutionRank - rightSolutionRank;
      }

      const leftAssumptionRank =
        assumptionRankMap.get(left.assumptionNodeId) ?? 999;
      const rightAssumptionRank =
        assumptionRankMap.get(right.assumptionNodeId) ?? 999;

      if (leftAssumptionRank !== rightAssumptionRank) {
        return leftAssumptionRank - rightAssumptionRank;
      }

      return compareRankable(left, right);
    })
    .map((test, index) => ({ ...test, rank: index + 1 }));

  return {
    ...review,
    solutions,
    assumptions,
    tests,
  };
}

function withCreatedOpportunity(
  review: ReviewState,
  opportunity: CreatedOpportunity,
): ReviewState {
  const treeNode: ReviewTreeNode = {
    id: opportunity.id,
    parentId: opportunity.parentId,
    outcomeId: opportunity.outcomeId,
    type: "opportunity",
    title: opportunity.title,
    description: opportunity.description,
    rank: opportunity.reviewPriority,
    active: false,
    isFocus: false,
  };

  return {
    ...review,
    path: review.path.map((node) =>
      node.id === opportunity.parentId
        ? {
            ...node,
            siblingLabel: nextSiblingOpportunityLabel(node.siblingLabel),
          }
        : node,
    ),
    tree: [
      ...review.tree.filter((current) => current.id !== opportunity.id),
      treeNode,
    ],
  };
}

function withCreatedSolution(
  review: ReviewState,
  solution: ReviewSolution,
): ReviewState {
  return normalizeReviewState({
    ...review,
    tree: [
      ...review.tree.filter((current) => current.id !== solution.id),
      {
        id: solution.id,
        parentId: solution.parentId,
        outcomeId: solution.outcomeId,
        type: "solution",
        title: solution.name,
        description: solution.description,
      status: solution.status,
      rank: solution.reviewPriority,
      active: false,
      isFocus: false,
    },
    ],
    solutions: [
      ...review.solutions.filter((current) => current.id !== solution.id),
      solution,
    ],
  });
}

function withCreatedAssumption(
  review: ReviewState,
  assumption: ReviewAssumption,
): ReviewState {
  const solution = review.solutions.find(
    (current) => current.id === assumption.solutionId,
  );

  return normalizeReviewState({
    ...review,
    tree: [
      ...review.tree.filter((current) => current.id !== assumption.id),
      {
        id: assumption.id,
        parentId: assumption.solutionId,
        outcomeId: solution?.outcomeId ?? review.outcome.id,
        type: "assumption",
        title: assumption.title,
        description: "",
        assumptionType: assumption.assumptionType,
        rank: assumption.reviewPriority,
        active: false,
        isFocus: false,
      },
    ],
    assumptions: [
      ...review.assumptions.filter((current) => current.id !== assumption.id),
      assumption,
    ],
  });
}

function withCreatedTest(review: ReviewState, test: ReviewTest): ReviewState {
  return normalizeReviewState({
    ...review,
    tests: [...review.tests.filter((current) => current.id !== test.id), test],
  });
}

function withUpdatedTest(
  review: ReviewState,
  testId: string,
  draft: TestDraft,
): ReviewState {
  const existingTest = review.tests.find((test) => test.id === testId);

  if (!existingTest) {
    return review;
  }

  const targetAssumption =
    review.assumptions.find(
      (assumption) => assumption.id === draft.assumptionNodeId,
    ) ??
    review.assumptions.find(
      (assumption) => assumption.id === existingTest.assumptionNodeId,
    );

  if (!targetAssumption) {
    return review;
  }

  const assumptionTitle = draft.assumptionTitle.trim();
  const movingAssumptions = targetAssumption.id !== existingTest.assumptionNodeId;
  const nextReviewPriority = movingAssumptions
    ? review.tests
        .filter(
          (test) =>
            test.assumptionNodeId === targetAssumption.id && test.id !== testId,
        )
        .reduce((max, test) => Math.max(max, test.reviewPriority), 0) + 1
    : existingTest.reviewPriority;

  return normalizeReviewState({
    ...review,
    tree: review.tree.map((node) =>
      node.id === targetAssumption.id
        ? {
            ...node,
            title: assumptionTitle,
            assumptionType: draft.assumptionType,
          }
        : node,
    ),
    assumptions: review.assumptions.map((assumption) =>
      assumption.id === targetAssumption.id
        ? {
            ...assumption,
            title: assumptionTitle,
            assumptionType: draft.assumptionType,
          }
        : assumption,
    ),
    tests: review.tests.map((test) => {
      const sharedAssumptionUpdate =
        test.assumptionNodeId === targetAssumption.id
          ? {
              assumption: assumptionTitle,
              assumptionType: draft.assumptionType,
            }
          : {};

      if (test.id !== testId) {
        return {
          ...test,
          ...sharedAssumptionUpdate,
        };
      }

      return {
        ...test,
        ...sharedAssumptionUpdate,
        assumptionNodeId: targetAssumption.id,
        solutionId: targetAssumption.solutionId,
        solutionName: targetAssumption.solutionName,
        assumption: assumptionTitle,
        assumptionType: draft.assumptionType,
        owner: draft.owner.trim(),
        role: draft.ownerRole.trim(),
        dueDate: draft.dueDate,
        status: draft.status,
        test: draft.testDescription.trim(),
        successCriteria: draft.successCriteria.trim(),
        progress: draft.progressNotes.trim(),
        verdict: draft.verdict,
        evidence: draft.evidence.trim(),
        reviewPriority: nextReviewPriority,
      };
    }),
  });
}

function withMovedTest(
  review: ReviewState,
  testId: string,
  targetAssumption: ReviewAssumption,
): ReviewState {
  const existingTest = review.tests.find((test) => test.id === testId);

  if (!existingTest || existingTest.assumptionNodeId === targetAssumption.id) {
    return review;
  }

  const nextReviewPriority =
    review.tests
      .filter(
        (test) =>
          test.assumptionNodeId === targetAssumption.id && test.id !== testId,
      )
      .reduce((max, test) => Math.max(max, test.reviewPriority), 0) + 1;

  return normalizeReviewState({
    ...review,
    tests: review.tests.map((test) =>
      test.id === testId
        ? {
            ...test,
            assumptionNodeId: targetAssumption.id,
            solutionId: targetAssumption.solutionId,
            solutionName: targetAssumption.solutionName,
            assumption: targetAssumption.title,
            assumptionType: targetAssumption.assumptionType,
            reviewPriority: nextReviewPriority,
          }
        : test,
    ),
  });
}

function withoutDeletedTest(review: ReviewState, testId: string): ReviewState {
  return normalizeReviewState({
    ...review,
    tests: review.tests.filter((test) => test.id !== testId),
  });
}

function nextReviewPriority(items: Array<{ reviewPriority: number }>) {
  return (
    items.reduce(
      (max, item) => Math.max(max, item.reviewPriority),
      0,
    ) + 1
  );
}

function nextTreeRank(
  review: ReviewState,
  parentId: string | null,
  type: TreeNodeType,
) {
  return (
    review.tree
      .filter((node) => node.parentId === parentId && node.type === type)
      .reduce((max, node) => Math.max(max, node.rank), 0) + 1
  );
}

function nearestOpportunityForParent(review: ReviewState, parentId: string | null) {
  let current =
    parentId != null ? review.tree.find((node) => node.id === parentId) : undefined;

  while (current) {
    if (current.type === "opportunity") {
      return current;
    }

    current =
      current.parentId != null
        ? review.tree.find((node) => node.id === current?.parentId)
        : undefined;
  }

  return review.focusOpportunity;
}

function makeOptimisticOpportunity(
  review: ReviewState,
  draft: AddDraft,
): CreatedOpportunity {
  const title = draft.title.trim();
  const parentId = draft.parentId || review.focusOpportunity.id;
  const parentNode = review.tree.find((node) => node.id === parentId);
  const reviewPriority = nextTreeRank(review, parentId, "opportunity");

  return {
    id: `optimistic-opportunity-${crypto.randomUUID()}`,
    parentId,
    outcomeId: parentNode?.outcomeId ?? review.outcome.id,
    title,
    description: draft.description.trim(),
    reviewPriority,
  };
}

function makeOptimisticSolution(
  review: ReviewState,
  draft: AddDraft,
): ReviewSolution {
  const title = draft.title.trim();
  const parentId = draft.parentId || review.focusOpportunity.id;
  const parentNode = review.tree.find((node) => node.id === parentId);
  const opportunity = nearestOpportunityForParent(review, parentId);
  const reviewPriority = nextTreeRank(review, parentId, "solution");

  return {
    id: `optimistic-solution-${crypto.randomUUID()}`,
    parentId,
    outcomeId: parentNode?.outcomeId ?? review.outcome.id,
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    rank: review.solutions.length + 1,
    name: title,
    description: draft.description.trim(),
    shortName: shortNameFromTitle(title),
    status: "active",
    reviewPriority,
    isFocus: false,
  };
}

function makeOptimisticAssumption(
  review: ReviewState,
  draft: AddDraft,
): ReviewAssumption | null {
  const solution = review.solutions.find(
    (currentSolution) => currentSolution.id === draft.solutionId,
  );

  if (!solution) {
    return null;
  }

  const reviewPriority = nextReviewPriority(
    review.assumptions.filter(
      (assumption) => assumption.solutionId === solution.id,
    ),
  );

  return {
    id: `optimistic-assumption-${crypto.randomUUID()}`,
    solutionId: solution.id,
    solutionName: solution.name,
    title: draft.title.trim(),
    assumptionType: draft.assumptionType,
    rank: review.assumptions.length + 1,
    reviewPriority,
  };
}

function makeOptimisticTest(
  review: ReviewState,
  draft: AddDraft,
): ReviewTest | null {
  const assumption = review.assumptions.find(
    (currentAssumption) => currentAssumption.id === draft.assumptionId,
  );
  const solution = assumption
    ? review.solutions.find(
        (currentSolution) => currentSolution.id === assumption.solutionId,
      )
    : null;

  if (!assumption || !solution) {
    return null;
  }

  const reviewPriority = nextReviewPriority(
    review.tests.filter((test) => test.assumptionNodeId === assumption.id),
  );

  return {
    id: `optimistic-test-${crypto.randomUUID()}`,
    assumptionNodeId: assumption.id,
    solutionId: solution.id,
    solutionName: solution.name,
    assumptionType: assumption.assumptionType,
    assumption: assumption.title,
    test: draft.testDescription.trim(),
    successCriteria: draft.successCriteria.trim(),
    owner: draft.owner.trim(),
    role: "",
    dueDate: draft.dueDate,
    status: "not_started",
    progress: "",
    verdict: "",
    evidence: "",
    rank: review.tests.length + 1,
    reviewPriority,
  };
}

function replaceCreatedSolution(
  review: ReviewState,
  optimisticId: string,
  solution: ReviewSolution,
): ReviewState {
  return withCreatedSolution({
    ...review,
    tree: review.tree.filter((current) => current.id !== optimisticId),
    solutions: review.solutions.filter((current) => current.id !== optimisticId),
  }, solution);
}

function replaceCreatedOpportunity(
  review: ReviewState,
  optimisticId: string,
  opportunity: CreatedOpportunity,
): ReviewState {
  return withCreatedOpportunity({
    ...review,
    tree: review.tree.filter((current) => current.id !== optimisticId),
  }, opportunity);
}

function replaceCreatedAssumption(
  review: ReviewState,
  optimisticId: string,
  assumption: ReviewAssumption,
): ReviewState {
  return withCreatedAssumption({
    ...review,
    tree: review.tree.filter((current) => current.id !== optimisticId),
    assumptions: review.assumptions.filter(
      (current) => current.id !== optimisticId,
    ),
  }, assumption);
}

function replaceCreatedTest(
  review: ReviewState,
  optimisticId: string,
  test: ReviewTest,
): ReviewState {
  const hasOptimisticTest = review.tests.some((current) => current.id === optimisticId);

  return normalizeReviewState({
    ...review,
    tests: hasOptimisticTest
      ? review.tests.map((current) => (current.id === optimisticId ? test : current))
      : [...review.tests, test],
  });
}

function withSolutionStatus(
  review: ReviewState,
  solutionId: string,
  status: SolutionStatus,
): ReviewState {
  return normalizeReviewState({
    ...review,
    tree: review.tree.map((node) =>
      node.id === solutionId && node.type === "solution"
        ? { ...node, status }
        : node,
    ),
    solutions: review.solutions.map((solution) =>
      solution.id === solutionId ? { ...solution, status } : solution,
    ),
  });
}

export default function ReviewClient({
  initialReview,
}: {
  initialReview: ReviewState;
}) {
  const [review, setReview] = useState(initialReview);
  const [selectedOpportunityFilterIds, setSelectedOpportunityFilterIds] = useState<
    string[] | null
  >(null);
  const [selectedSolutionFilterIds, setSelectedSolutionFilterIds] = useState<
    string[] | null
  >(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [moveTestId, setMoveTestId] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [expandedTreeOpportunityIds, setExpandedTreeOpportunityIds] = useState<
    string[]
  >([]);
  const [expandedTreeSolutionIds, setExpandedTreeSolutionIds] = useState<string[]>(
    [],
  );
  const [expandedTreeAssumptionIds, setExpandedTreeAssumptionIds] = useState<
    string[]
  >([]);
  const [expandedFilterOpportunityIds, setExpandedFilterOpportunityIds] =
    useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inlineAdd, setInlineAdd] = useState<InlineAddTarget | null>(null);
  const [treeEdit, setTreeEdit] = useState<TreeEditTarget | null>(null);
  const [treeDrag, setTreeDrag] = useState<TreeDragState | null>(null);
  const [addMenuKey, setAddMenuKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmTarget | null>(
    null,
  );
  const [addDraft, setAddDraft] = useState<AddDraft>(() =>
    makeEmptyAddDraft(initialReview),
  );
  const [treeEditDraft, setTreeEditDraft] = useState<TreeEditDraft | null>(null);
  const [detailDraft, setDetailDraft] = useState<TestDraft | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [teamDraft, setTeamDraft] = useState<TeamDraft>({ name: "", role: "" });
  const [addMessage, setAddMessage] = useState("");
  const [treeEditMessage, setTreeEditMessage] = useState("");
  const [detailMessage, setDetailMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [treeMessage, setTreeMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [detailState, setDetailState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [busy, setBusy] = useState(false);
  const moveTestRowRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!treeOpen && !settingsOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [treeOpen, settingsOpen]);

  useEffect(() => {
    if (!confirmationMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setConfirmationMessage(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [confirmationMessage]);

  const focusedOpportunityFilterIds = useMemo(
    () => review.focusOpportunities.map((opportunity) => opportunity.id),
    [review.focusOpportunities],
  );
  const focusedSolutionFilterIds = useMemo(
    () => {
      const focusedSolutionIds = review.solutions
        .filter((solution) => solution.isFocus)
        .map((solution) => solution.id);

      return focusedSolutionIds.length > 0
        ? focusedSolutionIds
        : review.solutions.map((solution) => solution.id);
    },
    [review.solutions],
  );
  const activeOpportunityFilterIds = useMemo(
    () =>
      (selectedOpportunityFilterIds ?? focusedOpportunityFilterIds).filter((id) =>
        focusedOpportunityFilterIds.includes(id),
      ),
    [focusedOpportunityFilterIds, selectedOpportunityFilterIds],
  );
  const activeSolutionFilterIds = useMemo(
    () =>
      (selectedSolutionFilterIds ?? focusedSolutionFilterIds).filter((id) =>
        focusedSolutionFilterIds.includes(id),
      ),
    [focusedSolutionFilterIds, selectedSolutionFilterIds],
  );

  useEffect(() => {
    if (!treeOpen || !moveTestId || !moveTestRowRef.current) {
      return;
    }

    moveTestRowRef.current.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    moveTestRowRef.current.focus({ preventScroll: true });
  }, [
    expandedTreeAssumptionIds,
    expandedTreeOpportunityIds,
    expandedTreeSolutionIds,
    moveTestId,
    treeOpen,
  ]);

  const activeSelectedSolutionId =
    activeSolutionFilterIds.length === 1 ? activeSolutionFilterIds[0] : null;
  const filtersActive =
    selectedOpportunityFilterIds !== null || selectedSolutionFilterIds !== null;

  const selectedTest =
    selectedTestId && review.tests.some((test) => test.id === selectedTestId)
      ? review.tests.find((test) => test.id === selectedTestId) ?? null
      : null;
  const movingTreeTest =
    moveTestId && review.tests.some((test) => test.id === moveTestId)
      ? review.tests.find((test) => test.id === moveTestId) ?? null
      : null;

  function syncSelectedTest(nextReview: ReviewState, nextTestId: string | null) {
    const nextTest =
      nextTestId != null
        ? nextReview.tests.find((test) => test.id === nextTestId) ?? null
        : null;

    setSelectedTestId(nextTest?.id ?? null);
    setDetailDraft(nextTest ? draftFromTest(nextTest) : null);
    setDetailMessage("");
    setDetailState("idle");
  }

  function selectTest(nextTestId: string | null, nextReview = review) {
    if (nextTestId == null || nextTestId !== moveTestId) {
      setMoveTestId(null);
    }

    syncSelectedTest(nextReview, nextTestId);
  }

  const queueSolutions = useMemo(
    () =>
      review.solutions.filter(
        (solution) =>
          activeSolutionFilterIds.includes(solution.id) &&
          activeOpportunityFilterIds.includes(solution.opportunityId),
      ),
    [activeOpportunityFilterIds, activeSolutionFilterIds, review.solutions],
  );

  const queueSolutionIds = useMemo(
    () => new Set(queueSolutions.map((solution) => solution.id)),
    [queueSolutions],
  );

  const visibleTests = useMemo(
    () =>
      review.tests.filter((test) => queueSolutionIds.has(test.solutionId)),
    [queueSolutionIds, review.tests],
  );

  const queueGroups = useMemo(
    () =>
      queueSolutions
        .map((solution) => ({
          solution,
          assumptions: review.assumptions
            .filter((assumption) => assumption.solutionId === solution.id)
            .map((assumption) => ({
              ...assumption,
              tests: review.tests.filter(
                (test) => test.assumptionNodeId === assumption.id,
              ),
            }))
        }))
        .filter((group) => group.assumptions.length > 0),
    [queueSolutions, review.assumptions, review.tests],
  );

  const treeNodesById = useMemo(
    () => new Map(review.tree.map((node) => [node.id, node])),
    [review.tree],
  );

  const treeChildrenByParent = useMemo(() => {
    const children = new Map<string, ReviewTreeNode[]>();

    review.tree.forEach((node) => {
      const key = node.parentId ?? "root";
      const siblings = children.get(key) ?? [];
      siblings.push(node);
      children.set(key, siblings);
    });

    return children;
  }, [review.tree]);

  function getTreeChildren(parentId: string | null, type?: TreeNodeType) {
    const children = treeChildrenByParent.get(parentId ?? "root") ?? [];
    return type ? children.filter((node) => node.type === type) : children;
  }

  function expandTreePathToAssumption(assumptionId: string) {
    const assumptionIds: string[] = [];
    const opportunityIds: string[] = [];
    const solutionIds: string[] = [];
    let current = treeNodesById.get(assumptionId);

    while (current?.parentId) {
      if (current.type === "assumption") {
        assumptionIds.push(current.id);
      }

      current = treeNodesById.get(current.parentId);

      if (current?.type === "solution") {
        solutionIds.push(current.id);
      } else if (current?.type === "opportunity") {
        opportunityIds.push(current.id);
      }
    }

    setExpandedTreeAssumptionIds((ids) => [
      ...ids,
      ...assumptionIds.filter((id) => !ids.includes(id)),
    ]);
    setExpandedTreeSolutionIds((ids) => [
      ...ids,
      ...solutionIds.filter((id) => !ids.includes(id)),
    ]);
    setExpandedTreeOpportunityIds((ids) => [
      ...ids,
      ...opportunityIds.filter((id) => !ids.includes(id)),
    ]);
  }

  const treeOutcome =
    review.tree.find((node) => node.type === "outcome") ??
    ({
      id: review.outcome.id,
      parentId: null,
      outcomeId: review.outcome.id,
      type: "outcome",
      title: review.outcome.title,
      description: review.outcome.description,
      rank: 1,
      active: true,
      isFocus: true,
    } satisfies ReviewTreeNode);
  const focusedOpportunityIds = useMemo(
    () => new Set(review.focusOpportunities.map((opportunity) => opportunity.id)),
    [review.focusOpportunities],
  );
  const focusOpportunityPathIds = useMemo(() => {
    const pathIds = new Set<string>();
    const focusIds =
      review.focusOpportunities.length > 0
        ? review.focusOpportunities.map((opportunity) => opportunity.id)
        : [review.focusOpportunity.id];

    focusIds.forEach((focusId) => {
      let current: ReviewTreeNode | undefined = treeNodesById.get(focusId);

      while (current?.type === "opportunity") {
        pathIds.add(current.id);
        current =
          current.parentId != null ? treeNodesById.get(current.parentId) : undefined;
      }
    });

    return pathIds;
  }, [review.focusOpportunities, review.focusOpportunity.id, treeNodesById]);
  function canDropTreeNode(nodeId: string, targetNodeId: string) {
    const node = treeNodesById.get(nodeId);
    const targetNode = treeNodesById.get(targetNodeId);

    return Boolean(
      node &&
        targetNode &&
        node.id !== targetNode.id &&
        node.type !== "outcome" &&
        targetNode.type !== "outcome" &&
        node.type === targetNode.type &&
        node.parentId === targetNode.parentId,
    );
  }

  function getDragPlacement(event: DragEvent<HTMLElement>): DragPlacement {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  }

  const queueCount =
    visibleTests.length === review.tests.length
      ? `${review.tests.length} tests`
      : `${visibleTests.length} of ${review.tests.length}`;
  const visibleAssumptionCount = queueGroups.reduce(
    (total, group) => total + group.assumptions.length,
    0,
  );
  const testsBySolutionId = useMemo(() => {
    const counts = new Map<string, { total: number; open: number }>();

    review.tests.forEach((test) => {
      const current = counts.get(test.solutionId) ?? { total: 0, open: 0 };
      current.total += 1;
      if (test.status !== "done") {
        current.open += 1;
      }
      counts.set(test.solutionId, current);
    });

    return counts;
  }, [review.tests]);
  const testsByOpportunityId = useMemo(() => {
    const solutionOpportunityMap = new Map(
      review.solutions.map((solution) => [solution.id, solution.opportunityId]),
    );
    const counts = new Map<string, { total: number; open: number }>();

    review.tests.forEach((test) => {
      const opportunityId = solutionOpportunityMap.get(test.solutionId);
      if (!opportunityId) {
        return;
      }

      const current = counts.get(opportunityId) ?? { total: 0, open: 0 };
      current.total += 1;
      if (test.status !== "done") {
        current.open += 1;
      }
      counts.set(opportunityId, current);
    });

    return counts;
  }, [review.solutions, review.tests]);
  const filterOpportunityBranches = useMemo(
    () =>
      review.focusOpportunities.map((opportunity) => ({
        opportunity,
        solutions: review.solutions.filter(
          (solution) => solution.opportunityId === opportunity.id,
        ),
      })),
    [review.focusOpportunities, review.solutions],
  );

  const topbarAvatars = useMemo(() => {
    const owners = review.teamMembers
      .map((member) => member.name.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map(getInitials);

    const merged = [...owners];
    for (const fallback of avatarFallbacks) {
      if (merged.length >= 4) {
        break;
      }
      merged.push(fallback);
    }

    return merged.slice(0, 4);
  }, [review.teamMembers]);

  async function refreshReview(options?: {
    preserveTestId?: string | null;
    preserveSolutionIds?: string[] | null;
  }) {
    const response = await fetch("/api/review", { cache: "no-store" });
    const payload = await parseJson<{ review: ReviewState }>(response);
    const nextReview = payload.review;
    setReview(nextReview);

    if (options?.preserveSolutionIds !== undefined) {
      setSelectedSolutionFilterIds(options.preserveSolutionIds);
    } else {
      const nextSolutionIds = new Set(nextReview.solutions.map((solution) => solution.id));
      const preservedSolutionIds =
        selectedSolutionFilterIds?.filter((id) => nextSolutionIds.has(id)) ?? null;
      setSelectedSolutionFilterIds(preservedSolutionIds);
    }

    const nextOpportunityIds = new Set(
      nextReview.focusOpportunities.map((opportunity) => opportunity.id),
    );
    setSelectedOpportunityFilterIds(
      selectedOpportunityFilterIds?.filter((id) => nextOpportunityIds.has(id)) ?? null,
    );

    const requestedTestId =
      options?.preserveTestId !== undefined ? options.preserveTestId : selectedTestId;

    syncSelectedTest(nextReview, requestedTestId ?? null);
    return nextReview;
  }

  async function setFocusOpportunity(nodeId: string) {
    setBusy(true);
    setTreeMessage("");
    try {
      await parseJson<{ ok: true }>(
        await fetch(`/api/review/nodes/${nodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFocus: true }),
        }),
      );

      await refreshReview({
        preserveSolutionIds: null,
        preserveTestId: null,
      });
      setExpandedTreeOpportunityIds((current) =>
        current.includes(nodeId) ? current : [...current, nodeId],
      );
    } catch (error) {
      setTreeMessage(error instanceof Error ? error.message : "Could not change focus.");
    } finally {
      setBusy(false);
    }
  }

  async function setFocusSolution(nodeId: string, isFocus: boolean) {
    setBusy(true);
    setTreeMessage("");
    try {
      await parseJson<{ ok: true }>(
        await fetch(`/api/review/nodes/${nodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFocus }),
        }),
      );

      await refreshReview({
        preserveSolutionIds: isFocus ? [nodeId] : null,
        preserveTestId: null,
      });
      setExpandedTreeSolutionIds((current) =>
        current.includes(nodeId) ? current : [...current, nodeId],
      );
    } catch (error) {
      setTreeMessage(
        error instanceof Error ? error.message : "Could not change solution focus.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setSolutionCompletion(
    solutionId: string,
    status: SolutionStatus,
  ) {
    const previousReview = review;
    setReview((current) => withSolutionStatus(current, solutionId, status));
    setBusy(true);
    setTreeMessage("");

    try {
      await parseJson<{ ok: true }>(
        await fetch(`/api/review/nodes/${solutionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }),
      );
    } catch (error) {
      setReview(previousReview);
      setTreeMessage(
        error instanceof Error
          ? error.message
          : "Could not update solution status.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openInlineAdd(
    kind: AddKind,
    options: {
      location: InlineAddLocation;
      anchorId: string;
      actionId?: string;
      actionLabel?: string;
      parentId?: string;
      depth?: number;
      solutionId?: string;
      assumptionId?: string;
    },
  ) {
    setAddMenuKey(null);
    setDeleteConfirm(null);
    setTreeEdit(null);
    setInlineAdd({
      key: `${options.location}:${options.anchorId}:${options.actionId ?? kind}`,
      kind,
      location: options.location,
      anchorId: options.anchorId,
      actionId: options.actionId,
      actionLabel: options.actionLabel,
      parentId: options.parentId,
      depth: options.depth,
      solutionId: options.solutionId,
      assumptionId: options.assumptionId,
    });
    setParsedItems(null);
    setAddMessage("");
    setConfirmationMessage("");
    setAddDraft(
      makeEmptyAddDraft(review, {
        parentId: options.parentId ?? "",
        solutionId:
          options.solutionId ??
          activeSelectedSolutionId ??
          review.solutions[0]?.id ??
          "",
        assumptionId: options.assumptionId ?? review.assumptions[0]?.id ?? "",
      }),
    );
  }

  function addConfirmation(kind: AddKind, title: string, count = 1) {
    const labels: Record<AddKind, string> = {
      opportunity: "Opportunity",
      solution: "Solution",
      assumption: "Assumption",
      test: "Test",
    };
    const suffix = count > 1 ? `${count} items added` : `${labels[kind]} added`;
    setConfirmationMessage(title ? `${suffix}: ${title}` : suffix);
  }

  function toggleFilterValue(
    currentIds: string[] | null,
    id: string,
    allIds: string[],
  ) {
    const current = currentIds ?? allIds;
    const next = current.includes(id)
      ? current.filter((currentId) => currentId !== id)
      : [...current, id];

    return next.length === allIds.length ? null : next;
  }

  function resetQueueFilters() {
    setSelectedOpportunityFilterIds(null);
    setSelectedSolutionFilterIds(null);
  }

  function openTreeEdit(node: ReviewTreeNode, depth = 0) {
    setInlineAdd(null);
    setAddMenuKey(null);
    setDeleteConfirm(null);
    setAddMessage("");
    setTreeEdit({
      key: `tree-edit:${node.id}`,
      nodeId: node.id,
      depth,
    });
    setTreeEditDraft(draftFromTreeNode(node));
    setTreeEditMessage("");
  }

  function toggleSolutionFilter(solutionId: string) {
    selectTest(null);
    setSelectedSolutionFilterIds((current) =>
      toggleFilterValue(current, solutionId, focusedSolutionFilterIds),
    );
  }

  function toggleOpportunityFilter(opportunityId: string) {
    selectTest(null);
    setSelectedOpportunityFilterIds((current) =>
      toggleFilterValue(current, opportunityId, focusedOpportunityFilterIds),
    );
  }

  function openTestMoveMode() {
    if (!selectedTest) {
      return;
    }

    setMoveTestId(selectedTest.id);
    setTreeOpen(true);
    setAddMenuKey(null);
    setDeleteConfirm(null);
    setInlineAdd(null);
    setTreeEdit(null);
    setTreeMessage("");
    expandTreePathToAssumption(selectedTest.assumptionNodeId);
  }

  function closeTreeDrawer() {
    setTreeOpen(false);
    setMoveTestId(null);
    setTreeMessage("");
  }

  async function moveTreeTestToAssumption(targetAssumptionId: string) {
    const testToMove = movingTreeTest;
    const targetAssumption = review.assumptions.find(
      (assumption) => assumption.id === targetAssumptionId,
    );

    if (!testToMove || !targetAssumption) {
      return;
    }

    if (testToMove.assumptionNodeId === targetAssumption.id) {
      setTreeMessage("This test is already under that assumption.");
      return;
    }

    const previousReview = review;
    const previousDraft = detailDraft;
    const previousSelectedSolutionFilterIds = selectedSolutionFilterIds;
    const nextReview = withMovedTest(review, testToMove.id, targetAssumption);
    const movedTest =
      nextReview.tests.find((test) => test.id === testToMove.id) ?? testToMove;

    setReview(nextReview);
    setSelectedTestId(movedTest.id);
    setSelectedSolutionFilterIds([targetAssumption.solutionId]);
    setDetailDraft((current) =>
      current && current.assumptionNodeId === testToMove.assumptionNodeId
        ? {
            ...current,
            assumptionNodeId: targetAssumption.id,
            assumptionTitle: targetAssumption.title,
            assumptionType: targetAssumption.assumptionType,
          }
        : draftFromTest(movedTest),
    );
    setTreeMessage("Moving test...");
    setBusy(true);
    expandTreePathToAssumption(targetAssumption.id);

    try {
      await parseJson<{ ok: true }>(
        await fetch(`/api/review/tests/${testToMove.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assumptionNodeId: targetAssumption.id }),
        }),
      );

      setTreeMessage("Moved test. Choose another destination or close the tree.");
      setConfirmationMessage(`Test moved: ${movedTest.test || "Untitled test"}`);
    } catch (error) {
      setReview(previousReview);
      setSelectedTestId(testToMove.id);
      setSelectedSolutionFilterIds(previousSelectedSolutionFilterIds);
      setDetailDraft(previousDraft);
      setTreeMessage(error instanceof Error ? error.message : "Could not move test.");
    } finally {
      setBusy(false);
    }
  }

  function toggleFilterOpportunityExpanded(opportunityId: string) {
    setExpandedFilterOpportunityIds((current) =>
      current.includes(opportunityId)
        ? current.filter((id) => id !== opportunityId)
        : [...current, opportunityId],
    );
  }

  function toggleExpandedOpportunity(nodeId: string) {
    setExpandedTreeOpportunityIds((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId],
    );
  }

  function toggleExpandedSolution(nodeId: string) {
    setExpandedTreeSolutionIds((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId],
    );
  }

  function toggleExpandedAssumption(nodeId: string) {
    setExpandedTreeAssumptionIds((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId],
    );
  }

  function selectTreeNode() {
    setAddMenuKey(null);
    setDeleteConfirm(null);
  }

  function treeAddActions(node: ReviewTreeNode): TreeAddAction[] {
    if (node.type === "outcome") {
      return [
        {
          id: "child-opportunity",
          label: "Opportunity",
          helper: "Nested one level deeper",
          group: "inside",
          kind: "opportunity",
          parentId: node.id,
        },
      ];
    }

    if (node.type === "opportunity") {
      const hasChildOpportunities = getTreeChildren(node.id, "opportunity").length > 0;
      const hasChildSolutions = getTreeChildren(node.id, "solution").length > 0;

      return [
        ...(node.parentId
          ? [
              {
                id: "sibling-opportunity",
                label: "Another opportunity",
                helper: "Same level, next to this card",
                group: "alongside" as const,
                kind: "opportunity" as const,
                parentId: node.parentId,
              },
            ]
          : []),
        {
          id: "child-opportunity",
          label: "Sub-opportunity",
          helper: "Nested one level deeper",
          group: "inside",
          kind: "opportunity",
          parentId: node.id,
          disabledReason: hasChildSolutions
            ? "This opportunity already branches into solutions"
            : undefined,
        },
        {
          id: "child-solution",
          label: "Solution",
          helper: hasChildOpportunities
            ? "This opportunity already branches into sub-opportunities"
            : "For this opportunity",
          group: "inside",
          kind: "solution",
          parentId: node.id,
          disabledReason: hasChildOpportunities
            ? "This opportunity already branches into sub-opportunities"
            : undefined,
        },
      ];
    }

    if (node.type === "solution") {
      const hasChildSolutions = getTreeChildren(node.id, "solution").length > 0;
      const hasChildAssumptions = getTreeChildren(node.id, "assumption").length > 0;

      return [
        ...(node.parentId
          ? [
              {
                id: "sibling-solution",
                label: "Another solution",
                helper: "Same level, next to this card",
                group: "alongside" as const,
                kind: "solution" as const,
                parentId: node.parentId,
              },
            ]
          : []),
        {
          id: "child-solution",
          label: "Sub-solution",
          helper: hasChildAssumptions
            ? "This solution already branches into assumptions"
            : "Nested one level deeper",
          group: "inside",
          kind: "solution",
          parentId: node.id,
          disabledReason: hasChildAssumptions
            ? "This solution already branches into assumptions"
            : undefined,
        },
        {
          id: "child-assumption",
          label: "Assumption",
          helper: hasChildSolutions
            ? "This solution already branches into sub-solutions"
            : "Risk or belief to test",
          group: "inside",
          kind: "assumption",
          solutionId: node.id,
          disabledReason: hasChildSolutions
            ? "This solution already branches into sub-solutions"
            : undefined,
        },
      ];
    }

    if (node.type === "assumption") {
      return [
        {
          id: "child-test",
          label: "Test",
          helper: "Experiment for this assumption",
          group: "inside",
          kind: "test",
          assumptionId: node.id,
          solutionId: node.parentId ?? "",
        },
      ];
    }

    return [];
  }

  function openTreeAction(
    node: ReviewTreeNode,
    action: TreeAddAction,
    depth = 0,
  ) {
    if (action.disabledReason) {
      return;
    }

    openInlineAdd(action.kind, {
      location: "tree",
      anchorId: node.id,
      actionId: action.id,
      actionLabel: action.label,
      parentId: action.parentId,
      depth,
      solutionId: action.solutionId,
      assumptionId: action.assumptionId,
    });
  }

  function countNestedItems(node: ReviewTreeNode) {
    const descendants: ReviewTreeNode[] = [];
    const pending = [...getTreeChildren(node.id)];

    while (pending.length > 0) {
      const child = pending.shift();
      if (!child) {
        continue;
      }

      descendants.push(child);
      pending.push(...getTreeChildren(child.id));
    }

    const affectedNodeIds = new Set([node.id, ...descendants.map((child) => child.id)]);
    const affectedTests = review.tests.filter(
      (test) =>
        affectedNodeIds.has(test.assumptionNodeId) ||
        affectedNodeIds.has(test.solutionId),
    );

    return descendants.length + affectedTests.length;
  }

  function buildDeletePrompt(target: DeleteConfirmTarget) {
    if (target.nestedCount < 1) {
      return `Delete this ${target.itemLabel}?`;
    }

    return `Delete this ${target.itemLabel} and its ${target.nestedCount} nested item${
      target.nestedCount === 1 ? "" : "s"
    }?`;
  }

  async function deleteTreeNode(node: ReviewTreeNode) {
    setBusy(true);
    setTreeEditMessage("");

    try {
      const response = await fetch(`/api/review/nodes/${node.id}`, {
        method: "DELETE",
      });

      await parseJson<{ ok: true }>(response);
      await refreshReview({
        preserveSolutionIds: selectedSolutionFilterIds,
        preserveTestId: selectedTestId,
      });

      setExpandedTreeOpportunityIds((current) =>
        current.filter((id) => id !== node.id),
      );
      setExpandedTreeSolutionIds((current) =>
        current.filter((id) => id !== node.id),
      );
      setExpandedTreeAssumptionIds((current) =>
        current.filter((id) => id !== node.id),
      );

      setDeleteConfirm(null);
      setInlineAdd(null);
      setTreeEdit(null);
    } catch (error) {
      setTreeEditMessage(
        error instanceof Error ? error.message : "Could not delete this item.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reorderTreeNode(
    nodeId: string,
    targetNodeId: string,
    placement: DragPlacement,
  ) {
    if (!canDropTreeNode(nodeId, targetNodeId)) {
      setTreeDrag(null);
      return;
    }

    setBusy(true);
    setTreeMessage("");

    try {
      const response = await fetch("/api/review/nodes/reorder", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nodeId, targetNodeId, placement }),
      });

      await parseJson<{ ok: true }>(response);
      await refreshReview({
        preserveSolutionIds: selectedSolutionFilterIds,
        preserveTestId: selectedTestId,
      });
    } catch (error) {
      setTreeMessage(
        error instanceof Error ? error.message : "Could not reorder this item.",
      );
    } finally {
      setTreeDrag(null);
      setBusy(false);
    }
  }

  function addTitleLabel(kind: AddKind) {
    if (kind === "opportunity") {
      return "Opportunity";
    }

    if (kind === "solution") {
      return "Solution";
    }

    if (kind === "assumption") {
      return "Assumption";
    }

    return "Test";
  }

  function addPlaceholder(kind: AddKind) {
    if (kind === "opportunity") {
      return "e.g. AI teams miss activation signals before launch";
    }

    if (kind === "solution") {
      return "e.g. Activity insights in PG hub";
    }

    if (kind === "assumption") {
      return "A belief that must be true...";
    }

    return "e.g. Prototype test with 8 researchers";
  }

  function renderInlineAddForm(target: InlineAddTarget) {
    if (inlineAdd?.key !== target.key) {
      return null;
    }

    const targetKind = target.kind;
    const titleValue =
      targetKind === "test" ? addDraft.testDescription : addDraft.title;
    const titleLines = titleValue
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const shouldParseFirst = titleLines.length > 1;
    const previewingParsedItems =
      inlineAdd?.key === target.key && parsedItems != null;

    return (
      <form
        key={target.key}
        className={`inline-add-form inline-add-${target.location}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (previewingParsedItems) {
            void commitParsedItems(target);
            return;
          }

          if (shouldParseFirst) {
            runInlineParse(target);
            return;
          }

          void commitInlineAdd();
        }}
        style={
          {
            "--tree-offset": `${(target.depth ?? 0) * 18}px`,
          } as CSSProperties
        }
      >
        <label className="field-group inline-add-title">
          <span className="eyebrow">
            {target.actionLabel ?? addTitleLabel(targetKind)}
          </span>
          <textarea
            autoFocus
            className="field-textarea compact"
            onChange={(event) =>
              {
                setParsedItems(null);
                setAddDraft((current) =>
                  targetKind === "test"
                    ? { ...current, testDescription: event.target.value }
                    : { ...current, title: event.target.value },
                );
              }
            }
            placeholder={`${addPlaceholder(targetKind)}\nOr paste multiple ${addTitleLabel(targetKind).toLowerCase()}s, one per line`}
            value={titleValue}
          />
        </label>

        {previewingParsedItems ? (
          <div className="inline-parsed-panel">
            <div className="inline-parsed-header">
              <span className="eyebrow">Parsed items</span>
              <button
                className="secondary-button"
                onClick={() => setParsedItems(null)}
                type="button"
              >
                Edit paste
              </button>
            </div>
            <div className="parsed-list compact">
              {parsedItems.map((item) => (
                <button
                  className={`parsed-row ${item.include ? "included" : ""}`}
                  key={item.id}
                  onClick={() => toggleParsedItem(item.id)}
                  type="button"
                >
                  <span className={`checkmark ${item.include ? "on" : ""}`}>
                    {item.include ? "✓" : ""}
                  </span>
                  <span className="parsed-copy">
                    <span className="parsed-kind">{item.kind}</span>
                    <strong>{item.title}</strong>
                    <span className="parsed-meta">
                      {item.kind === "assumption"
                        ? `Type: ${typeMeta[item.assumptionType].label}`
                        : item.kind === "test"
                          ? item.assumptionTitle || target.actionLabel || "New test"
                          : target.actionLabel || ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!previewingParsedItems && (targetKind === "opportunity" || targetKind === "solution") ? (
          <label className="field-group">
            <span className="eyebrow">Description</span>
            <textarea
              className="field-textarea compact"
              onChange={(event) =>
                setAddDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Optional context"
              value={addDraft.description}
            />
          </label>
        ) : null}

        {!previewingParsedItems && targetKind === "assumption" ? (
          <div className="inline-add-grid">
            {!target.solutionId ? (
              <label className="field-group">
                <span className="eyebrow">Under solution</span>
                <select
                  className="field-input"
                  onChange={(event) =>
                    setAddDraft((current) => ({
                      ...current,
                      solutionId: event.target.value,
                    }))
                  }
                  value={addDraft.solutionId}
                >
                  {review.solutions.map((solution) => (
                    <option key={solution.id} value={solution.id}>
                      {solution.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field-group">
              <span className="eyebrow">Type</span>
              <select
                className="field-input"
                onChange={(event) =>
                  setAddDraft((current) => ({
                    ...current,
                    assumptionType: event.target.value as AssumptionType,
                  }))
                }
                value={addDraft.assumptionType}
              >
                {Object.entries(typeMeta).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {!previewingParsedItems && targetKind === "test" ? (
          <>
            {!target.assumptionId ? (
              <label className="field-group">
                <span className="eyebrow">Tests which assumption</span>
                <select
                  className="field-input"
                  onChange={(event) =>
                    setAddDraft((current) => ({
                      ...current,
                      assumptionId: event.target.value,
                    }))
                  }
                  value={addDraft.assumptionId}
                >
                  {review.assumptions.map((assumption) => (
                    <option key={assumption.id} value={assumption.id}>
                      {`${bestNameMatch(review.solutions, assumption.solutionName, (solution) => solution.name)?.shortName ?? assumption.solutionName} - ${assumption.title}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field-group">
              <span className="eyebrow">Success criteria</span>
              <textarea
                className="field-textarea compact"
                onChange={(event) =>
                  setAddDraft((current) => ({
                    ...current,
                    successCriteria: event.target.value,
                  }))
                }
                placeholder="What result would validate the assumption?"
                value={addDraft.successCriteria}
              />
            </label>

            <div className="inline-add-grid">
              <label className="field-group">
                <span className="eyebrow">Owner</span>
                <select
                  className="field-input"
                  onChange={(event) =>
                    setAddDraft((current) => ({
                      ...current,
                      owner: event.target.value,
                    }))
                  }
                  value={addDraft.owner}
                >
                  <option value="">Unassigned</option>
                  {review.teamMembers.map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span className="eyebrow">Due</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setAddDraft((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                  type="date"
                  value={addDraft.dueDate}
                />
              </label>
            </div>
          </>
        ) : null}

        <div className="inline-add-actions">
          {addMessage ? <span className="inline-add-message">{addMessage}</span> : null}
          <button
            className="secondary-button"
            onClick={() => {
              setInlineAdd(null);
              setAddMessage("");
            }}
            type="button"
          >
            Cancel
          </button>
          <button className="primary-button" disabled={busy} type="submit">
            {previewingParsedItems
              ? "Add selected"
              : shouldParseFirst
                ? "Parse items"
                : "Add"}
          </button>
        </div>
      </form>
    );
  }

  function renderTreeEditForm(node: ReviewTreeNode, depth: number) {
    if (treeEdit?.key !== `tree-edit:${node.id}` || !treeEditDraft) {
      return null;
    }

    const showDescription = node.type !== "assumption";

    return (
      <form
        className="inline-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveTreeEdit(node);
        }}
        style={
          {
            "--tree-offset": `${depth * 18}px`,
          } as CSSProperties
        }
      >
        <label className="field-group">
          <span className="eyebrow">{treeTypeLabels[node.type]}</span>
          <input
            autoFocus
            className="field-input"
            onChange={(event) =>
              setTreeEditDraft((current) =>
                current ? { ...current, title: event.target.value } : current,
              )
            }
            value={treeEditDraft.title}
          />
        </label>

        {showDescription ? (
          <label className="field-group">
            <span className="eyebrow">Description</span>
            <textarea
              className="field-textarea compact"
              onChange={(event) =>
                setTreeEditDraft((current) =>
                  current
                    ? { ...current, description: event.target.value }
                    : current,
                )
              }
              placeholder="Optional context"
              value={treeEditDraft.description}
            />
          </label>
        ) : null}

        {node.type === "assumption" ? (
          <label className="field-group">
            <span className="eyebrow">Type</span>
            <select
              className="field-input"
              onChange={(event) =>
                setTreeEditDraft((current) =>
                  current
                    ? {
                        ...current,
                        assumptionType: event.target.value as AssumptionType,
                      }
                    : current,
                )
              }
              value={treeEditDraft.assumptionType}
            >
              {Object.entries(typeMeta).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="inline-edit-actions">
          {treeEditMessage ? (
            <span className="inline-add-message">{treeEditMessage}</span>
          ) : null}
          <button
            className="secondary-button"
            onClick={() => {
              setTreeEdit(null);
              setTreeEditDraft(null);
              setTreeEditMessage("");
            }}
            type="button"
          >
            Cancel
          </button>
          <button className="primary-button" disabled={busy} type="submit">
            Save
          </button>
        </div>
      </form>
    );
  }

  function renderTreeRow(
    node: ReviewTreeNode,
    options?: { active?: boolean; depth?: number },
  ) {
    const isOpportunityExpanded =
      node.type === "opportunity" && expandedTreeOpportunityIds.includes(node.id);
    const isSolutionExpanded =
      node.type === "solution" && expandedTreeSolutionIds.includes(node.id);
    const isAssumptionExpanded =
      node.type === "assumption" && expandedTreeAssumptionIds.includes(node.id);
    const isSelected =
      options?.active ??
      (isOpportunityExpanded || isSolutionExpanded || isAssumptionExpanded);
    const assumptionMeta =
      node.type === "assumption" && node.assumptionType
        ? typeMeta[node.assumptionType]
        : null;
    const addActions = treeAddActions(node);
    const depth = options?.depth ?? 0;
    const isTerminalFocusedSolution =
      node.type === "solution" &&
      review.solutions.some(
        (solution) => solution.id === node.id && solution.isFocus,
      );
    const addKey = `tree-add:${node.id}`;
    const moreKey = `tree-more:${node.id}`;
    const deleteTarget =
      deleteConfirm?.nodeId === node.id ? deleteConfirm : null;
    const hasOpenTreePopover =
      addMenuKey === addKey || addMenuKey === moreKey || Boolean(deleteTarget);
    const actionGroups: Array<TreeAddAction["group"]> = ["alongside", "inside"];
    const canDrag = node.type !== "outcome";
    const isDragging = treeDrag?.nodeId === node.id;
    const dropPlacement =
      treeDrag?.targetId === node.id ? treeDrag.placement : null;
    const isCompletedSolution =
      node.type === "solution" && node.status === "completed";
    const opportunityChildCount =
      node.type === "opportunity"
        ? getTreeChildren(node.id, "opportunity").length
        : 0;
    const opportunitySolutionCount =
      node.type === "opportunity"
        ? getTreeChildren(node.id, "solution").length
        : 0;
    const opportunityNestedCount =
      opportunityChildCount + opportunitySolutionCount;
    const isFocusOpportunity =
      node.type === "opportunity" && focusedOpportunityIds.has(node.id);
    const isFocusPathOpportunity =
      node.type === "opportunity" && focusOpportunityPathIds.has(node.id);
    const canSetOpportunityFocus =
      node.type === "opportunity" && !isFocusPathOpportunity;
    const canToggleSolutionFocus =
      node.type === "solution" && (!node.isFocus || isTerminalFocusedSolution);
    const hasFocusedSolutions = review.tree.some(
      (treeNode) => treeNode.type === "solution" && treeNode.isFocus,
    );
    const solutionChildCount =
      node.type === "solution" ? getTreeChildren(node.id, "solution").length : 0;
    const solutionAssumptionCount =
      node.type === "solution" ? getTreeChildren(node.id, "assumption").length : 0;
    const solutionNestedCount = solutionChildCount + solutionAssumptionCount;
    const assumptionTestCount =
      node.type === "assumption"
        ? review.tests.filter((test) => test.assumptionNodeId === node.id).length
        : 0;
    const isMoveSourceAssumption =
      node.type === "assumption" && movingTreeTest?.assumptionNodeId === node.id;
    const canMoveTestHere =
      node.type === "assumption" && Boolean(movingTreeTest) && !isMoveSourceAssumption;
    const isFocusSolution = node.type === "solution" && node.isFocus;
    const isFocusRow = isFocusOpportunity || isFocusSolution;
    const isFocusPathRow =
      !isFocusRow &&
      (isFocusPathOpportunity ||
        (node.type !== "solution" && node.isFocus && node.type !== "outcome"));
    const isMutedRow =
      (node.type === "opportunity" &&
        !isFocusOpportunity &&
        !isFocusPathOpportunity &&
        !isOpportunityExpanded) ||
      (node.type === "solution" && hasFocusedSolutions && !isFocusSolution);
    const nodeTypeMeta = treeTypeMeta[node.type];
    const NodeTypeIcon = nodeTypeMeta.icon;

    return (
      <Fragment key={node.id}>
      <div
        aria-grabbed={canDrag ? isDragging : undefined}
        className={`tree-row tree-row-${node.type} ${isSelected ? "active" : ""} ${
          canDrag ? "draggable" : ""
        } ${isDragging ? "dragging" : ""} ${
          dropPlacement ? `drop-${dropPlacement}` : ""
        } ${isCompletedSolution ? "completed" : ""} ${
          isFocusRow ? "focused" : ""
        } ${isFocusPathRow ? "focus-path" : ""} ${
          isMutedRow ? "muted" : ""
        } ${isMoveSourceAssumption ? "move-source-assumption" : ""} ${
          hasOpenTreePopover ? "popover-open" : ""
        }`}
        draggable={canDrag && !busy}
        onDragEnd={() => setTreeDrag(null)}
        onDragOver={(event) => {
          const draggedId = treeDrag?.nodeId ?? event.dataTransfer.getData("text/plain");
          if (!draggedId || !canDropTreeNode(draggedId, node.id)) {
            return;
          }

          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          const placement = getDragPlacement(event);
          setTreeDrag((current) =>
            current?.targetId === node.id && current.placement === placement
              ? current
              : { nodeId: draggedId, targetId: node.id, placement },
          );
        }}
        onDragStart={(event) => {
          if (!canDrag) {
            event.preventDefault();
            return;
          }

          setAddMenuKey(null);
          setDeleteConfirm(null);
          setTreeDrag({ nodeId: node.id, targetId: null, placement: null });
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.id);
        }}
        onDrop={(event) => {
          const draggedId = treeDrag?.nodeId ?? event.dataTransfer.getData("text/plain");
          if (!draggedId || !canDropTreeNode(draggedId, node.id)) {
            setTreeDrag(null);
            return;
          }

          event.preventDefault();
          void reorderTreeNode(draggedId, node.id, getDragPlacement(event));
        }}
        style={
          {
            "--tree-depth": String(depth),
            "--tree-offset": `${depth * 18}px`,
          } as CSSProperties
        }
      >
        <div
          className="tree-row-main"
          onClick={selectTreeNode}
        >
          {node.type === "solution" ? (
            <span className="solution-rank">{node.rank}</span>
          ) : null}
          {canDrag ? (
            <span className="tree-drag-handle" aria-hidden="true">
              <GripVertical size={14} />
            </span>
          ) : null}
          <span className="tree-row-copy">
            <span className="tree-label-line">
              <span className={`tree-type-chip tree-type-${node.type}`}>
                <NodeTypeIcon aria-hidden="true" size={12} />
                {nodeTypeMeta.label}
              </span>
              {node.isFocus && node.type !== "outcome" ? (
                <span className="reviewing-pill">Focus</span>
              ) : null}
              {isCompletedSolution ? (
                <span className="completed-pill">
                  <CheckCircle2 aria-hidden="true" size={12} />
                  Completed
                </span>
              ) : null}
            </span>
            <button
              aria-label={`Edit ${treeTypeLabels[node.type].toLowerCase()}`}
              className="tree-title-edit"
              onClick={(event) => {
                event.stopPropagation();
                openTreeEdit(node, depth);
              }}
              type="button"
            >
              <strong>{node.title}</strong>
              <span className="edit-tooltip">Click to edit</span>
            </button>
          </span>
          {assumptionMeta ? (
            <span
              className={`type-pill ${assumptionMeta.textClass} ${assumptionMeta.bgClass}`}
            >
              {assumptionMeta.label}
            </span>
          ) : null}
        </div>

        <div className="tree-row-actions">
          {isMoveSourceAssumption ? (
            <span className="tree-current-move-pill">Current</span>
          ) : null}
          {canMoveTestHere ? (
            <button
              className="tree-move-here-button"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                void moveTreeTestToAssumption(node.id);
              }}
              type="button"
            >
              <MoveRight aria-hidden="true" size={13} />
              <span>Move here</span>
            </button>
          ) : null}
          {node.type === "opportunity" && opportunityNestedCount > 0 ? (
            <button
              aria-expanded={isOpportunityExpanded}
              className="tree-disclosure-button"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpandedOpportunity(node.id);
              }}
              type="button"
            >
              <ChevronDown
                aria-hidden="true"
                className={isOpportunityExpanded ? "open" : ""}
                size={14}
              />
              <span>
                {isOpportunityExpanded ? "Hide" : "Show"}{" "}
                {opportunityChildCount > 0
                  ? `${opportunityChildCount} opportunit${
                      opportunityChildCount === 1 ? "y" : "ies"
                    }`
                  : `${opportunitySolutionCount} solution${
                      opportunitySolutionCount === 1 ? "" : "s"
                    }`}
              </span>
            </button>
          ) : null}
          {node.type === "solution" && solutionNestedCount > 0 ? (
            <button
              aria-expanded={isSolutionExpanded}
              className="tree-disclosure-button"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpandedSolution(node.id);
              }}
              type="button"
            >
              <ChevronDown
                aria-hidden="true"
                className={isSolutionExpanded ? "open" : ""}
                size={14}
              />
              <span>
                {isSolutionExpanded ? "Hide" : "Show"}{" "}
                {solutionAssumptionCount > 0
                  ? `${solutionAssumptionCount} assumption${
                      solutionAssumptionCount === 1 ? "" : "s"
                    }`
                  : `${solutionChildCount} solution${
                      solutionChildCount === 1 ? "" : "s"
                    }`}
              </span>
            </button>
          ) : null}
          {node.type === "assumption" ? (
            <button
              aria-expanded={isAssumptionExpanded}
              className="tree-disclosure-button"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpandedAssumption(node.id);
              }}
              type="button"
            >
              <ChevronDown
                aria-hidden="true"
                className={isAssumptionExpanded ? "open" : ""}
                size={14}
              />
              <span>
                {isAssumptionExpanded ? "Hide" : "Show"} {assumptionTestCount} test
                {assumptionTestCount === 1 ? "" : "s"}
              </span>
            </button>
          ) : null}
          {canSetOpportunityFocus ? (
            <button
              className="tree-focus-button"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                void setFocusOpportunity(node.id);
              }}
              type="button"
            >
              <Pin aria-hidden="true" size={13} />
              <span>Set focus</span>
            </button>
          ) : null}
          {canToggleSolutionFocus ? (
            <button
              aria-label={
                node.isFocus ? "Unset solution focus" : "Set solution focus"
              }
              aria-pressed={node.isFocus}
              className={`tree-icon-button tree-focus-icon-button ${
                node.isFocus ? "active" : ""
              }`}
              data-tooltip={node.isFocus ? "Unset focus" : "Set focus"}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                void setFocusSolution(node.id, !node.isFocus);
              }}
              title={node.isFocus ? "Unset focus" : "Set focus"}
              type="button"
            >
              <Pin aria-hidden="true" size={13} />
            </button>
          ) : null}
          {addActions.length > 0 ? (
            <div className="tree-add-menu-wrap">
              <button
                aria-label={`Add inside or alongside this ${treeTypeLabels[
                  node.type
                ].toLowerCase()}`}
                aria-expanded={addMenuKey === addKey}
                className={
                  node.type === "solution"
                    ? "tree-icon-button add-dropdown-button"
                    : "tree-action-button add-dropdown-button"
                }
                data-tooltip={node.type === "solution" ? "Add" : undefined}
                onClick={() => {
                  setDeleteConfirm(null);
                  setAddMenuKey((current) =>
                    current === addKey ? null : addKey,
                  );
                }}
                title="Add"
                type="button"
              >
                <Plus aria-hidden="true" size={14} />
                {node.type !== "solution" ? (
                  <>
                    <span>Add</span>
                    <ChevronDown aria-hidden="true" size={13} />
                  </>
                ) : null}
              </button>

              {addMenuKey === addKey ? (
                <div className="tree-add-menu" role="menu">
                  {actionGroups.map((group) => {
                    const groupActions = addActions.filter(
                      (action) => action.group === group,
                    );

                    if (groupActions.length === 0) {
                      return null;
                    }

                    return (
                      <div className="tree-add-menu-group" key={group}>
                        <div className="tree-add-menu-label">
                          <span>
                            {group === "alongside" ? "Alongside" : "Inside"}
                          </span>
                          <small>
                            {group === "alongside"
                              ? "Same level, next to this card"
                              : "Nested one level deeper"}
                          </small>
                        </div>
                        {groupActions.map((action) => (
                          <button
                            aria-disabled={Boolean(action.disabledReason)}
                            className={`tree-add-menu-item ${
                              action.disabledReason ? "disabled" : ""
                            }`}
                            disabled={Boolean(action.disabledReason)}
                            key={action.id}
                            onClick={() => openTreeAction(node, action, depth)}
                            role="menuitem"
                            type="button"
                          >
                            <Circle aria-hidden="true" size={13} />
                            <span>
                              <strong>{action.label}</strong>
                              <small>
                                {action.disabledReason ?? action.helper}
                              </small>
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          {node.type === "solution" ? (
            <div className="tree-more-wrap">
              <button
                aria-expanded={addMenuKey === moreKey}
                aria-label="More solution actions"
                className="tree-icon-button tree-more-button"
                data-tooltip="More actions"
                onClick={() => {
                  setDeleteConfirm(null);
                  setAddMenuKey((current) =>
                    current === moreKey ? null : moreKey,
                  );
                }}
                title="More actions"
                type="button"
              >
                <MoreHorizontal aria-hidden="true" size={16} />
              </button>
              {addMenuKey === moreKey ? (
                <div className="tree-more-menu" role="menu">
                  <button
                    className="tree-more-menu-item"
                    disabled={busy}
                    onClick={() => {
                      void setSolutionCompletion(
                        node.id,
                        isCompletedSolution ? "active" : "completed",
                      );
                      setAddMenuKey(null);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <CheckCircle2 aria-hidden="true" size={14} />
                    <span>{isCompletedSolution ? "Reopen" : "Complete"}</span>
                  </button>
                  <button
                    className="tree-more-menu-item danger"
                    onClick={() => {
                      setAddMenuKey(null);
                      setDeleteConfirm({
                        nodeId: node.id,
                        itemLabel: treeTypeLabels[node.type].toLowerCase(),
                        nestedCount: countNestedItems(node),
                      });
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              ) : null}
              {deleteTarget ? (
                <div className="delete-confirm-popover">
                  <p>{buildDeletePrompt(deleteTarget)}</p>
                  <div className="delete-confirm-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setDeleteConfirm(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button danger"
                      disabled={busy}
                      onClick={() => deleteTreeNode(node)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : node.type !== "outcome" ? (
            <div className="tree-delete-wrap">
              <button
                aria-label={`Delete ${treeTypeLabels[node.type].toLowerCase()}`}
                className="tree-delete-button"
                onClick={() => {
                  setAddMenuKey(null);
                  setDeleteConfirm({
                    nodeId: node.id,
                    itemLabel: treeTypeLabels[node.type].toLowerCase(),
                    nestedCount: countNestedItems(node),
                  });
                }}
                type="button"
              >
                <Trash2 aria-hidden="true" size={14} />
              </button>
              {deleteTarget ? (
                <div className="delete-confirm-popover">
                  <p>{buildDeletePrompt(deleteTarget)}</p>
                  <div className="delete-confirm-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setDeleteConfirm(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button danger"
                      disabled={busy}
                      onClick={() => deleteTreeNode(node)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {renderTreeEditForm(node, depth)}
      {addActions.map((action) =>
        renderInlineAddForm({
          key: `tree:${node.id}:${action.id}`,
          kind: action.kind,
          location: "tree",
          anchorId: node.id,
          actionId: action.id,
          actionLabel: action.label,
          parentId: action.parentId,
          depth,
          solutionId: action.solutionId,
          assumptionId: action.assumptionId,
        }),
      )}
      </Fragment>
    );
  }

  async function saveSelectedTest() {
    if (!selectedTest || !detailDraft) {
      return;
    }

    const previousReview = review;
    const previousDraft = detailDraft;
    const previousSelectedSolutionFilterIds = selectedSolutionFilterIds;
    const nextReview = withUpdatedTest(review, selectedTest.id, detailDraft);
    const nextTest =
      nextReview.tests.find((test) => test.id === selectedTest.id) ?? selectedTest;

    setReview(nextReview);
    setSelectedTestId(nextTest.id);
    setSelectedSolutionFilterIds([nextTest.solutionId]);
    setDetailDraft(draftFromTest(nextTest));
    setDetailState("saving");
    setDetailMessage("Saving changes...");

    try {
      const response = await fetch(`/api/review/tests/${selectedTest.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...detailDraft,
          assumptionNodeId: detailDraft.assumptionNodeId,
        }),
      });

      await parseJson<{ ok: true }>(response);
      setDetailState("saved");
      setDetailMessage("Saved");
    } catch (error) {
      setReview(previousReview);
      setSelectedTestId(selectedTest.id);
      setSelectedSolutionFilterIds(previousSelectedSolutionFilterIds);
      setDetailDraft(previousDraft);
      setDetailState("error");
      setDetailMessage(
        error instanceof Error ? error.message : "Could not save changes.",
      );
    }
  }

  async function deleteSelectedTest() {
    if (!selectedTest) {
      return;
    }

    if (!window.confirm("Delete this test?")) {
      return;
    }

    setBusy(true);
    setDetailMessage("Deleting...");

    const previousReview = review;
    const deletedTestId = selectedTest.id;
    const nextReview = withoutDeletedTest(review, deletedTestId);

    setReview(nextReview);
    setSelectedTestId(null);
    setDetailDraft(null);

    try {
      const response = await fetch(`/api/review/tests/${deletedTestId}`, {
        method: "DELETE",
      });

      await parseJson<{ ok: true }>(response);
      setDetailMessage("");
    } catch (error) {
      setReview(previousReview);
      syncSelectedTest(previousReview, deletedTestId);
      setDetailMessage(
        error instanceof Error ? error.message : "Could not delete this test.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addTeamMember() {
    setBusy(true);
    setSettingsMessage("");

    try {
      const response = await fetch("/api/review/team-members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(teamDraft),
      });

      await parseJson<{ ok: true }>(response);
      await refreshReview({
        preserveSolutionIds: selectedSolutionFilterIds,
        preserveTestId: selectedTestId,
      });
      setTeamDraft({ name: "", role: "" });
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : "Could not add teammate.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeamMember(memberId: string) {
    setBusy(true);
    setSettingsMessage("");

    try {
      const response = await fetch(
        `/api/review/team-members?id=${encodeURIComponent(memberId)}`,
        {
          method: "DELETE",
        },
      );

      await parseJson<{ ok: true }>(response);
      await refreshReview({
        preserveSolutionIds: selectedSolutionFilterIds,
        preserveTestId: selectedTestId,
      });
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : "Could not remove teammate.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function commitInlineAdd() {
    if (!inlineAdd) {
      return;
    }

    setBusy(true);
    setAddMessage("");

    const previousReview = review;
    const previousSelectedSolutionFilterIds = selectedSolutionFilterIds;
    const previousSelectedTestId = selectedTestId;
    const previousDetailDraft = detailDraft;
    let shouldReopenOnError = false;

    const restorePreviousSelection = () => {
      setSelectedSolutionFilterIds(previousSelectedSolutionFilterIds);

      if (previousSelectedTestId) {
        syncSelectedTest(previousReview, previousSelectedTestId);
        return;
      }

      setSelectedTestId(null);
      setDetailDraft(previousDetailDraft);
    };

    try {
      const kind = inlineAdd.kind;
      let nextReview = review;
      let nextSelectedSolutionId = activeSelectedSolutionId;

      if (kind === "opportunity") {
        if (!addDraft.title.trim()) {
          throw new Error("Opportunity title is required.");
        }

        const optimisticOpportunity = makeOptimisticOpportunity(nextReview, addDraft);
        nextReview = withCreatedOpportunity(nextReview, optimisticOpportunity);
        setReview(nextReview);
        setInlineAdd(null);
        setParsedItems(null);
        shouldReopenOnError = true;

        const response = await fetch("/api/review/opportunities", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: addDraft.title,
            description: addDraft.description,
            parentId: addDraft.parentId,
          }),
        });

        const payload = await parseJson<{ opportunity: CreatedOpportunity }>(
          response,
        );
        nextReview = replaceCreatedOpportunity(
          nextReview,
          optimisticOpportunity.id,
          payload.opportunity,
        );
        setReview(nextReview);
        addConfirmation("opportunity", payload.opportunity.title);
      }

      if (kind === "solution") {
        if (!addDraft.title.trim()) {
          throw new Error("Solution name is required.");
        }

        const optimisticSolution = makeOptimisticSolution(nextReview, addDraft);
        nextReview = withCreatedSolution(nextReview, optimisticSolution);
        nextSelectedSolutionId = nextReview.solutions.some(
          (solution) => solution.id === optimisticSolution.id,
        )
          ? optimisticSolution.id
          : activeSelectedSolutionId;

        setReview(nextReview);
        setSelectedSolutionFilterIds(
          nextSelectedSolutionId ? [nextSelectedSolutionId] : null,
        );
        setInlineAdd(null);
        setParsedItems(null);
        shouldReopenOnError = true;

        const response = await fetch("/api/review/solutions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: addDraft.title,
            description: addDraft.description,
            parentId: addDraft.parentId,
          }),
        });

        const payload = await parseJson<{ solution: ReviewSolution }>(response);
        nextReview = replaceCreatedSolution(
          nextReview,
          optimisticSolution.id,
          payload.solution,
        );
        nextSelectedSolutionId = nextReview.solutions.some(
          (solution) => solution.id === payload.solution.id,
        )
          ? payload.solution.id
          : activeSelectedSolutionId;
        setReview(nextReview);
        setSelectedSolutionFilterIds(
          nextSelectedSolutionId ? [nextSelectedSolutionId] : null,
        );
        addConfirmation("solution", payload.solution.name);
      }

      if (kind === "assumption") {
        if (!addDraft.title.trim() || !addDraft.solutionId) {
          throw new Error("Solution and assumption title are required.");
        }

        const optimisticAssumption = makeOptimisticAssumption(nextReview, addDraft);

        if (!optimisticAssumption) {
          throw new Error("Solution not found.");
        }

        nextReview = withCreatedAssumption(nextReview, optimisticAssumption);
        nextSelectedSolutionId = optimisticAssumption.solutionId;

        setReview(nextReview);
        setSelectedSolutionFilterIds(
          nextSelectedSolutionId ? [nextSelectedSolutionId] : null,
        );
        setInlineAdd(null);
        setParsedItems(null);
        shouldReopenOnError = true;

        const response = await fetch("/api/review/assumptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            solutionId: addDraft.solutionId,
            title: addDraft.title,
            assumptionType: addDraft.assumptionType,
          }),
        });

        const payload = await parseJson<{ assumption: ReviewAssumption }>(response);
        nextReview = replaceCreatedAssumption(
          nextReview,
          optimisticAssumption.id,
          payload.assumption,
        );
        nextSelectedSolutionId = payload.assumption.solutionId;
        setReview(nextReview);
        setSelectedSolutionFilterIds(
          nextSelectedSolutionId ? [nextSelectedSolutionId] : null,
        );
        addConfirmation("assumption", payload.assumption.title);
      }

      if (kind === "test") {
        if (!addDraft.assumptionId || !addDraft.testDescription.trim()) {
          throw new Error("Assumption and test description are required.");
        }

        const optimisticTest = makeOptimisticTest(nextReview, addDraft);

        if (!optimisticTest) {
          throw new Error("Assumption not found.");
        }

        nextReview = withCreatedTest(nextReview, optimisticTest);
        nextSelectedSolutionId = optimisticTest.solutionId;

        setReview(nextReview);
        setSelectedSolutionFilterIds(
          nextSelectedSolutionId ? [nextSelectedSolutionId] : null,
        );
        syncSelectedTest(nextReview, optimisticTest.id);
        setInlineAdd(null);
        setParsedItems(null);
        shouldReopenOnError = true;

        const response = await fetch("/api/review/tests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assumptionNodeId: addDraft.assumptionId,
            testDescription: addDraft.testDescription,
            successCriteria: addDraft.successCriteria,
            owner: addDraft.owner,
            dueDate: addDraft.dueDate,
          }),
        });

        const payload = await parseJson<{ test: ReviewTest }>(response);
        nextReview = replaceCreatedTest(nextReview, optimisticTest.id, payload.test);
        nextSelectedSolutionId = payload.test.solutionId;

        setReview(nextReview);
        setSelectedSolutionFilterIds(
          nextSelectedSolutionId ? [nextSelectedSolutionId] : null,
        );
        syncSelectedTest(nextReview, payload.test.id);
        addConfirmation("test", payload.test.test);
      }
    } catch (error) {
      if (shouldReopenOnError) {
        setReview(previousReview);
        restorePreviousSelection();
        setInlineAdd(inlineAdd);
      }

      setAddMessage(
        error instanceof Error ? error.message : "Could not add item.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveTreeEdit(node: ReviewTreeNode) {
    if (!treeEditDraft) {
      return;
    }

    if (!treeEditDraft.title.trim()) {
      setTreeEditMessage(`${treeTypeLabels[node.type]} title is required.`);
      return;
    }

    setBusy(true);
    setTreeEditMessage("");

    try {
      const response = await fetch(`/api/review/nodes/${node.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: treeEditDraft.title,
          description: treeEditDraft.description,
          ...(node.type === "assumption"
            ? { assumptionType: treeEditDraft.assumptionType }
            : {}),
        }),
      });

      await parseJson<{ ok: true }>(response);
      await refreshReview({
        preserveSolutionIds: selectedSolutionFilterIds,
        preserveTestId: selectedTestId,
      });
      setTreeEdit(null);
      setTreeEditDraft(null);
    } catch (error) {
      setTreeEditMessage(
        error instanceof Error ? error.message : "Could not save item.",
      );
    } finally {
      setBusy(false);
    }
  }

  function runInlineParse(target: InlineAddTarget) {
    const source =
      target.kind === "test" ? addDraft.testDescription : addDraft.title;
    const parsed = parseBrainstorm(source, target.kind);

    if (parsed.length === 0) {
      setAddMessage("Nothing clear to parse yet. Try one item per line.");
      return;
    }

    setParsedItems(parsed);
    setAddMessage("");
  }

  function toggleParsedItem(id: string) {
    setParsedItems((current) =>
      current?.map((item) =>
        item.id === id ? { ...item, include: !item.include } : item,
      ) ?? null,
    );
  }

  async function commitParsedItems(target?: InlineAddTarget) {
    if (!parsedItems) {
      return;
    }

    const includedItems = parsedItems.filter((item) => item.include);
    if (includedItems.length === 0) {
      setAddMessage("Select at least one parsed item.");
      return;
    }

    setBusy(true);
    setAddMessage("");

    try {
      let workingReview = review;
      const commitReview = (nextReview: ReviewState) => {
        workingReview = nextReview;
        setReview(nextReview);
      };

      for (const item of includedItems.filter((entry) => entry.kind === "opportunity")) {
        const parentId =
          target?.kind === "opportunity"
            ? target.parentId
            : item.kind === target?.kind
              ? addDraft.parentId
              : undefined;

        const payload = await fetch("/api/review/opportunities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            description: item.description,
            parentId,
          }),
        }).then(parseJson<{ opportunity: CreatedOpportunity }>);
        commitReview(withCreatedOpportunity(workingReview, payload.opportunity));
      }

      for (const item of includedItems.filter((entry) => entry.kind === "solution")) {
        const parentId =
          target?.kind === "solution"
            ? target.parentId
            : item.kind === target?.kind
              ? addDraft.parentId
              : undefined;

        const payload = await fetch("/api/review/solutions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            description: item.description,
            parentId,
          }),
        }).then(parseJson<{ solution: ReviewSolution }>);
        commitReview(withCreatedSolution(workingReview, payload.solution));
      }

      const assumptionCandidates = [
        ...includedItems.filter((entry) => entry.kind === "assumption"),
        ...includedItems
          .filter(
            (entry) =>
              entry.kind === "test" &&
              entry.assumptionTitle &&
              !bestNameMatch(
                workingReview.assumptions,
                entry.assumptionTitle,
                (assumption) => assumption.title,
              ),
          )
          .map((entry) => ({
            ...entry,
            kind: "assumption" as const,
            title: entry.assumptionTitle,
          })),
      ];
      const pendingAssumptionKeys = new Set<string>();

      for (const item of assumptionCandidates) {
        const solution =
          (target?.kind === "assumption" && target.solutionId
            ? workingReview.solutions.find(
                (entry) => entry.id === target.solutionId,
              )
            : null) ??
          (target?.kind === "assumption" && addDraft.solutionId
            ? workingReview.solutions.find(
                (entry) => entry.id === addDraft.solutionId,
              )
            : null) ??
          bestNameMatch(
            workingReview.solutions,
            item.solutionName,
            (entry) => entry.name,
          ) ?? workingReview.solutions[0];

        if (!solution) {
          continue;
        }

        const exists = bestNameMatch(
          workingReview.assumptions.filter(
            (assumption) => assumption.solutionId === solution.id,
          ),
          item.title,
          (assumption) => assumption.title,
        );

        const pendingKey = `${solution.id}::${item.title.trim().toLowerCase()}`;
        if (exists || pendingAssumptionKeys.has(pendingKey)) {
          continue;
        }

        pendingAssumptionKeys.add(pendingKey);
        const payload = await fetch("/api/review/assumptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solutionId: solution.id,
            title: item.title,
            assumptionType: item.assumptionType,
          }),
        }).then(parseJson<{ assumption: ReviewAssumption }>);
        commitReview(withCreatedAssumption(workingReview, payload.assumption));
      }

      for (const item of includedItems.filter((entry) => entry.kind === "test")) {
        const assumption =
          (target?.kind === "test" && target.assumptionId
            ? workingReview.assumptions.find(
                (entry) => entry.id === target.assumptionId,
              )
            : null) ??
          (target?.kind === "test" && addDraft.assumptionId
            ? workingReview.assumptions.find(
                (entry) => entry.id === addDraft.assumptionId,
              )
            : null) ??
          bestNameMatch(
            workingReview.assumptions,
            item.assumptionTitle,
            (entry) => entry.title,
          );

        if (!assumption || !item.title.trim()) {
          continue;
        }

        const payload = await fetch("/api/review/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assumptionNodeId: assumption.id,
            testDescription: item.title,
            successCriteria: item.successCriteria,
            owner: item.owner,
            dueDate: item.dueDate,
          }),
        }).then(parseJson<{ test: ReviewTest }>);
        commitReview(withCreatedTest(workingReview, payload.test));
      }

      if (selectedTestId) {
        syncSelectedTest(workingReview, selectedTestId);
      }

      setParsedItems(null);
      setInlineAdd(null);
      addConfirmation(
        includedItems[0]?.kind ?? "assumption",
        includedItems.length === 1 ? includedItems[0]?.title ?? "" : "",
        includedItems.length,
      );
    } catch (error) {
      setAddMessage(
        error instanceof Error ? error.message : "Could not add parsed items.",
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedAssumption =
    review.assumptions.find(
      (assumption) => assumption.id === selectedTest?.assumptionNodeId,
    ) ?? null;
  const siblingTests = selectedTest
    ? review.tests.filter(
        (test) => test.assumptionNodeId === selectedTest.assumptionNodeId,
      )
    : [];

  function renderAssumptionBranch(assumption: ReviewTreeNode, depth: number) {
    const expanded = expandedTreeAssumptionIds.includes(assumption.id);
    const tests = review.tests.filter(
      (test) => test.assumptionNodeId === assumption.id,
    );

    return (
      <div className="tree-subtree" key={assumption.id}>
        {renderTreeRow(assumption, {
          active: expanded,
          depth,
        })}
        {expanded ? (
          <div
            className="tree-test-list"
            style={
              {
                "--tree-depth": String(depth + 1),
                "--tree-offset": `${(depth + 1) * 18}px`,
              } as CSSProperties
            }
          >
            {tests.length > 0 ? (
              tests.map((test) => {
                const status = statusMeta[test.status];
                const isMovingTest = moveTestId === test.id;

                return (
                  <button
                    aria-current={isMovingTest ? "true" : undefined}
                    className={`tree-test-row ${isMovingTest ? "move-source-test" : ""}`}
                    key={test.id}
                    onClick={() => {
                      if (moveTestId) {
                        return;
                      }

                      selectTest(test.id);
                      setTreeOpen(false);
                    }}
                    ref={
                      isMovingTest
                        ? (element) => {
                            moveTestRowRef.current = element;
                          }
                        : undefined
                    }
                    type="button"
                  >
                    <span
                      className={`test-row-dot ${status.dotClass}`}
                      aria-hidden="true"
                    />
                    <span>{test.test || "Untitled test"}</span>
                    <span
                      className={`status-pill ${status.textClass} ${status.bgClass}`}
                    >
                      {status.label}
                    </span>
                  </button>
                );
              })
            ) : (
              <button
                className="tree-test-row empty"
                onClick={() =>
                  openInlineAdd("test", {
                    location: "tree",
                    anchorId: assumption.id,
                    depth,
                    assumptionId: assumption.id,
                    solutionId: assumption.parentId ?? "",
                  })
                }
                type="button"
              >
                No tests yet
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function renderSolutionBranch(solution: ReviewTreeNode, depth: number) {
    const expanded = expandedTreeSolutionIds.includes(solution.id);
    const childSolutions = getTreeChildren(solution.id, "solution");
    const assumptions = getTreeChildren(solution.id, "assumption");

    return (
      <div className="tree-subtree" key={solution.id}>
        {renderTreeRow(solution, {
          active: expanded,
          depth,
        })}
        {expanded ? (
          <div className="tree-nested-list">
            {childSolutions.length > 0
              ? childSolutions.map((childSolution) =>
                  renderSolutionBranch(childSolution, depth + 1),
                )
              : assumptions.map((assumption) =>
                  renderAssumptionBranch(assumption, depth + 1),
                )}
          </div>
        ) : null}
      </div>
    );
  }

  function renderOpportunityBranch(opportunity: ReviewTreeNode, depth: number) {
    const expanded = expandedTreeOpportunityIds.includes(opportunity.id);
    const childOpportunities = getTreeChildren(opportunity.id, "opportunity");
    const solutions = getTreeChildren(opportunity.id, "solution");

    return (
      <div className="tree-subtree" key={opportunity.id}>
        {renderTreeRow(opportunity, {
          active: expanded,
          depth,
        })}
        {expanded ? (
          <div className="tree-nested-list">
            {childOpportunities.length > 0
              ? childOpportunities.map((childOpportunity) =>
                  renderOpportunityBranch(childOpportunity, depth + 1),
                )
              : solutions.map((solution) =>
                  renderSolutionBranch(solution, depth + 1),
                )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main
      className={`review-app ${
        treeOpen || settingsOpen ? "modal-open" : ""
      }`}
    >
      <header className="topbar">
        <div className="brand-lockup">
          <Image
            alt=""
            aria-hidden="true"
            className="brand-orb"
            height={24}
            src="/dcx.png"
            width={24}
          />
          <div className="brand-copy">
            <strong>Continuous Discovery</strong>
            <span>DCX</span>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="review-week">{review.reviewLabel}</span>
          <div className="avatar-stack" aria-label="Review participants">
            {topbarAvatars.map((avatar) => (
              <span className="avatar-chip" key={avatar}>
                {avatar}
              </span>
            ))}
          </div>
          <button
            className="tree-button"
            onClick={() => {
              setSettingsMessage("");
              setSettingsOpen(true);
            }}
            type="button"
          >
            <Settings2 aria-hidden="true" size={14} />
            Team
          </button>
          <button
            className="tree-button"
            onClick={() => {
              setExpandedTreeOpportunityIds([]);
              setExpandedTreeSolutionIds([]);
              setExpandedTreeAssumptionIds([]);
              setTreeOpen(true);
            }}
            type="button"
          >
            <Network aria-hidden="true" size={14} />
            Full tree
          </button>
        </div>
      </header>

      <OutcomeProgress outcomeTitle={review.outcome.title} />

      {confirmationMessage ? (
        <div className="confirmation-toast" role="status">
          <Check aria-hidden="true" size={14} />
          <span>{confirmationMessage}</span>
        </div>
      ) : null}

      <section className={`review-workspace ${selectedTest ? "detail-open" : ""}`}>
        <aside className="focus-rail filter-rail">
          <div className="focus-heading-row">
            <div>
              <div className="eyebrow">Filters</div>
              <h1>Focused discovery work</h1>
            </div>
            <button
              className="focus-change-button"
              onClick={() => {
                setTreeMessage("");
                setExpandedTreeOpportunityIds([]);
                setExpandedTreeSolutionIds([]);
                setExpandedTreeAssumptionIds([]);
                setTreeOpen(true);
              }}
              type="button"
            >
              <Network aria-hidden="true" size={14} />
              Tree
            </button>
          </div>
          <div className="focus-chip-row">
            <span className="focus-chip">
              <ListFilter aria-hidden="true" size={13} />
              Queue filters
            </span>
            <span className="focus-depth">
              Showing {queueSolutions.length} of {review.solutions.length} focused
              solutions · {visibleAssumptionCount} assumptions
            </span>
          </div>

          <div className="rail-divider" />

          <div className="filter-toolbar">
            <span className="eyebrow">Focused opportunities</span>
            {filtersActive ? (
              <button
                className="filter-reset-button"
                onClick={resetQueueFilters}
                type="button"
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="filter-tree-list">
            {filterOpportunityBranches.map(({ opportunity, solutions }) => {
              const counts = testsByOpportunityId.get(opportunity.id) ?? {
                total: 0,
                open: 0,
              };
              const checked = activeOpportunityFilterIds.includes(opportunity.id);
              const expanded = expandedFilterOpportunityIds.includes(opportunity.id);

              return (
                <div className="filter-tree-branch" key={opportunity.id}>
                  <div className="filter-tree-row">
                    <button
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Collapse" : "Expand"} solutions for ${opportunity.title}`}
                      className="filter-disclosure-button"
                      disabled={solutions.length === 0}
                      onClick={() => toggleFilterOpportunityExpanded(opportunity.id)}
                      type="button"
                    >
                      <ChevronDown aria-hidden="true" size={15} />
                    </button>
                    <label className="filter-option filter-opportunity-option">
                      <input
                        checked={checked}
                        onChange={() => toggleOpportunityFilter(opportunity.id)}
                        type="checkbox"
                      />
                      <span className="filter-option-copy">
                        <strong>{opportunity.title}</strong>
                        <small>
                          {solutions.length} solution
                          {solutions.length === 1 ? "" : "s"} · {counts.total} test
                          {counts.total === 1 ? "" : "s"} · {counts.open} open
                        </small>
                      </span>
                    </label>
                  </div>

                  {expanded ? (
                    <div className="filter-solution-branch">
                      {solutions.map((solution) => {
                        const solutionCounts = testsBySolutionId.get(solution.id) ?? {
                          total: 0,
                          open: 0,
                        };
                        const solutionChecked = activeSolutionFilterIds.includes(
                          solution.id,
                        );

                        return (
                          <label
                            className={`filter-option filter-solution-option ${
                              solution.status === "completed" ? "completed" : ""
                            }`}
                            key={solution.id}
                          >
                            <input
                              checked={solutionChecked}
                              onChange={() => toggleSolutionFilter(solution.id)}
                              type="checkbox"
                            />
                            <span className="filter-option-copy">
                              <span className="filter-solution-title">
                                <span className="solution-rank">{solution.rank}</span>
                                <strong>{solution.name}</strong>
                              </span>
                              <small>
                                {solutionCounts.total} test
                                {solutionCounts.total === 1 ? "" : "s"} ·{" "}
                                {solutionCounts.open} open
                              </small>
                              {solution.status === "completed" ? (
                                <span className="completed-pill compact">
                                  <CheckCircle2 aria-hidden="true" size={11} />
                                  Completed
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="filter-helper">
            Focus is managed in the full tree. These controls only narrow the queue.
          </p>
        </aside>

        <section className="queue-surface">
          <div className="queue-header">
            <div>
              <div className="queue-heading-row">
                <h2>Assumption test queue</h2>
                <span className="queue-count">{queueCount}</span>
              </div>
              <p>Ordered by full tree order, then by test priority. Work top-down.</p>
            </div>

            <div className="queue-actions">
              {filtersActive ? (
                <button
                  className="queue-filter-pill"
                  onClick={resetQueueFilters}
                  type="button"
                >
                  Filters active
                  <span className="queue-filter-close" aria-hidden="true">
                    <X size={10} />
                  </span>
                </button>
              ) : null}

              <button
                className="primary-button"
                onClick={() =>
                  openInlineAdd("test", {
                    location: "queue",
                    anchorId: review.outcome.id,
                    solutionId:
                      activeSelectedSolutionId ??
                      queueSolutions[0]?.id ??
                      "",
                  })
                }
                disabled={queueSolutions.length < 1}
                type="button"
              >
                <Plus aria-hidden="true" size={14} />
                Add tests
              </button>
            </div>
          </div>
          {renderInlineAddForm({
            key: `queue:${review.outcome.id}:test`,
            kind: "test",
            location: "queue",
            anchorId: review.outcome.id,
            solutionId:
              activeSelectedSolutionId ??
              queueSolutions[0]?.id ??
              "",
          })}

          <div className="queue-table">
            <div className="queue-table-head">
              <span>Solution</span>
              <span>Assumption</span>
              <span>Status</span>
            </div>

            {queueGroups.map(({ solution, assumptions }) => {
              const isCompleted = solution.status === "completed";

              return (
                <div className="queue-group" key={solution.id}>
                  <div
                    className={`queue-solution-cell focused ${
                      isCompleted ? "completed" : ""
                    }`}
                  >
                    <div className="queue-solution-focus">
                      <span className="solution-rank">{solution.rank}</span>
                      <span className="queue-solution-copy">
                        <strong>{solution.name}</strong>
                        {isCompleted ? (
                          <span className="completed-pill compact">
                            <CheckCircle2 aria-hidden="true" size={11} />
                            Completed
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  <div className="queue-assumption-stack">
                    {assumptions.map((assumption) => {
                      const assumptionTypeMeta = typeMeta[assumption.assumptionType];
                      const tests = assumption.tests;

                      return (
                        <div className="assumption-block" key={assumption.id}>
                          <div className="assumption-heading">
                            <span
                              className={`type-pill ${assumptionTypeMeta.textClass} ${assumptionTypeMeta.bgClass}`}
                            >
                              {assumptionTypeMeta.label}
                            </span>
                            <strong>{assumption.title}</strong>
                            <button
                              className="add-inline-button"
                              onClick={() =>
                                openInlineAdd("test", {
                                  location: "queue",
                                  anchorId: assumption.id,
                                  assumptionId: assumption.id,
                                  solutionId: assumption.solutionId,
                                })
                              }
                              type="button"
                            >
                              <Plus aria-hidden="true" size={11} />
                              test
                            </button>
                          </div>
                          {renderInlineAddForm({
                            key: `queue:${assumption.id}:test`,
                            kind: "test",
                            location: "queue",
                            anchorId: assumption.id,
                            assumptionId: assumption.id,
                            solutionId: assumption.solutionId,
                          })}

                          <div className="assumption-tests">
                            {tests.length > 0 ? (
                              tests.map((test) => {
                                const status = statusMeta[test.status];
                                const overdue = isOverdue(test.dueDate, test.status);
                                const isSelected = selectedTest?.id === test.id;

                                return (
                                  <button
                                    className={`test-row ${isSelected ? "selected" : ""}`}
                                    key={test.id}
                                    onClick={() => {
                                      selectTest(test.id);
                                    }}
                                    type="button"
                                  >
                                    <span
                                      className={`test-row-dot ${status.dotClass}`}
                                      aria-hidden="true"
                                    />
                                    <span className="test-row-copy">
                                      {test.test || "Untitled test"}
                                    </span>
                                    <span
                                      className="owner-mini-pill"
                                      title={test.owner || "Unassigned"}
                                    >
                                      {getInitials(test.owner)}
                                    </span>
                                    <span
                                      className={`test-row-due ${
                                        overdue ? "overdue" : ""
                                      }`}
                                    >
                                      {formatDueDate(test.dueDate)}
                                    </span>
                                    <span className="test-row-status">
                                      <span
                                        className={`status-pill ${status.textClass} ${status.bgClass}`}
                                      >
                                        {status.label}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              <button
                                className="test-row empty"
                                onClick={() =>
                                  openInlineAdd("test", {
                                    location: "queue",
                                    anchorId: assumption.id,
                                    assumptionId: assumption.id,
                                    solutionId: assumption.solutionId,
                                  })
                                }
                                type="button"
                              >
                                No tests yet — add the first test
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {queueGroups.length === 0 ? (
              <div className="queue-empty-state">
                <strong>No assumptions match these filters.</strong>
                <p>Reset filters or change the focused opportunities and solutions in the tree.</p>
                {filtersActive ? (
                  <button
                    className="secondary-button"
                    onClick={resetQueueFilters}
                    type="button"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="queue-endnote">
            <span className="queue-endnote-dot" aria-hidden="true" />
            End of queue for focused solutions · filters do not change tree focus
          </div>
        </section>

        <aside className={`detail-rail ${selectedTest ? "open" : ""}`}>
          {selectedTest && detailDraft && selectedAssumption ? (
            <>
              <div className="detail-header">
                <span className="detail-solution-pill">
                  <span className="solution-rank mini">
                    {
                      review.solutions.find(
                        (solution) => solution.id === selectedTest.solutionId,
                      )?.rank
                    }
                  </span>
                  {selectedTest.solutionName}
                </span>
                <button
                  className="detail-close"
                  onClick={() => selectTest(null)}
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </div>

              <div className="detail-label-row">
                <span className="eyebrow">Assumption we&apos;re testing</span>
                <span
                  className={`type-pill ${typeMeta[detailDraft.assumptionType].textClass} ${typeMeta[detailDraft.assumptionType].bgClass}`}
                >
                  {typeMeta[detailDraft.assumptionType].label}
                </span>
              </div>

              <textarea
                className="field-textarea assumption-title-input"
                onChange={(event) =>
                  setDetailDraft((current) =>
                    current
                      ? { ...current, assumptionTitle: event.target.value }
                      : current,
                  )
                }
                value={detailDraft.assumptionTitle}
              />

              <div className="detail-assumption-row">
                <span>{buildSiblingLabel(siblingTests, selectedTest.id)}</span>
                <button
                  className="detail-link-button"
                  onClick={openTestMoveMode}
                  type="button"
                >
                  <MoveRight aria-hidden="true" size={12} />
                  Move to another assumption
                </button>
                <button
                  className="add-inline-button"
                  onClick={() =>
                    openInlineAdd("test", {
                      location: "detail",
                      anchorId: selectedAssumption.id,
                      assumptionId: selectedAssumption.id,
                      solutionId: selectedAssumption.solutionId,
                    })
                  }
                  type="button"
                >
                  <Plus aria-hidden="true" size={12} />
                  Add another test
                </button>
              </div>
              {renderInlineAddForm({
                key: `detail:${selectedAssumption.id}:test`,
                kind: "test",
                location: "detail",
                anchorId: selectedAssumption.id,
                assumptionId: selectedAssumption.id,
                solutionId: selectedAssumption.solutionId,
              })}

              <div className="detail-edit-grid">
                <label className="field-group">
                  <span className="eyebrow">Assumption type</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current
                          ? {
                              ...current,
                              assumptionType: event.target.value as AssumptionType,
                            }
                          : current,
                      )
                    }
                    value={detailDraft.assumptionType}
                  >
                    {Object.entries(typeMeta).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="eyebrow">Owner</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current
                          ? {
                              ...current,
                              owner: event.target.value,
                              ownerRole: roleForOwner(review, event.target.value),
                            }
                          : current,
                      )
                    }
                    value={detailDraft.owner}
                  >
                    <option value="">Unassigned</option>
                    {detailDraft.owner &&
                    !review.teamMembers.some(
                      (member) => member.name === detailDraft.owner,
                    ) ? (
                      <option value={detailDraft.owner}>
                        {detailDraft.owner} (not in team)
                      </option>
                    ) : null}
                    {review.teamMembers.map((member) => (
                      <option key={member.id} value={member.name}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="eyebrow">Role</span>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current
                          ? { ...current, ownerRole: event.target.value }
                          : current,
                      )
                    }
                    placeholder="Discovery lead"
                    value={detailDraft.ownerRole}
                  />
                </label>

                <label className="field-group">
                  <span className="eyebrow">Due</span>
                  <div className="field-with-icon">
                    <CalendarDays aria-hidden="true" size={15} />
                    <input
                      className="field-input date-input"
                      onChange={(event) =>
                        setDetailDraft((current) =>
                          current
                            ? { ...current, dueDate: event.target.value }
                            : current,
                        )
                      }
                      type="date"
                      value={detailDraft.dueDate}
                    />
                  </div>
                </label>
              </div>

              <div className="detail-section">
                <span className="eyebrow">The test</span>
                <textarea
                  className="field-textarea"
                  onChange={(event) =>
                    setDetailDraft((current) =>
                      current
                        ? { ...current, testDescription: event.target.value }
                        : current,
                    )
                  }
                  placeholder="Describe the test..."
                  value={detailDraft.testDescription}
                />
              </div>

              <div className="criteria-card editable">
                <div className="criteria-title">
                  <CheckCircle2 aria-hidden="true" size={14} />
                  <span>Success criteria</span>
                </div>
                <textarea
                  className="field-textarea criteria-textarea"
                  onChange={(event) =>
                    setDetailDraft((current) =>
                      current
                        ? { ...current, successCriteria: event.target.value }
                        : current,
                    )
                  }
                  placeholder="What result would validate the assumption?"
                  value={detailDraft.successCriteria}
                />
              </div>

              <div className="detail-section">
                <span className="eyebrow">Test status</span>
                <div className="status-toggle">
                  {(Object.keys(statusMeta) as TestStatus[]).map((statusKey) => {
                    const status = statusMeta[statusKey];
                    const active = detailDraft.status === statusKey;

                    return (
                      <button
                        className={`status-toggle-button ${active ? "active" : ""}`}
                        key={statusKey}
                        onClick={() =>
                          setDetailDraft((current) =>
                            current ? { ...current, status: statusKey } : current,
                          )
                        }
                        type="button"
                      >
                        <span
                          className={`status-toggle-dot ${status.dotClass}`}
                          aria-hidden="true"
                        />
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {detailDraft.status === "in_progress" ? (
                <div className="detail-section">
                  <span className="eyebrow">Progress commentary</span>
                  <textarea
                    className="field-textarea"
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current
                          ? { ...current, progressNotes: event.target.value }
                          : current,
                      )
                    }
                    placeholder="How is it going? What are we learning so far?"
                    value={detailDraft.progressNotes}
                  />
                </div>
              ) : null}

              {detailDraft.status === "done" ? (
                <div className="detail-section">
                  <div className="complete-title">
                    <CheckCircle2 aria-hidden="true" size={14} />
                    Outcome of the test
                  </div>
                  <div className="verdict-row">
                    {(["validated", "invalidated"] as const).map((verdict) => (
                      <button
                        className={`verdict-button ${
                          detailDraft.verdict === verdict ? "active" : ""
                        } ${verdict}`}
                        key={verdict}
                        onClick={() =>
                          setDetailDraft((current) =>
                            current ? { ...current, verdict } : current,
                          )
                        }
                        type="button"
                      >
                        {verdict === "validated" ? "Validated" : "Invalidated"}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="field-textarea"
                    onChange={(event) =>
                      setDetailDraft((current) =>
                        current ? { ...current, evidence: event.target.value } : current,
                      )
                    }
                    placeholder="Summarise the result and the evidence behind it..."
                    value={detailDraft.evidence}
                  />
                </div>
              ) : null}

              <div className="detail-footer">
                <button
                  className="secondary-button danger"
                  onClick={deleteSelectedTest}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={14} />
                  Delete test
                </button>

                <div className="detail-save-cluster">
                  <span className={`save-message ${detailState}`}>{detailMessage}</span>
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={saveSelectedTest}
                    type="button"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="detail-empty">
              <p>Select a test to update its owner, due date, status, and evidence.</p>
            </div>
          )}
        </aside>
      </section>

      {settingsOpen ? (
        <div
          className="modal-scrim"
          onClick={() => setSettingsOpen(false)}
          role="presentation"
        >
          <div
            className="settings-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div>
                <h3>Team settings</h3>
                <p>
                  {review.teamMembers.length}{" "}
                  {review.teamMembers.length === 1 ? "person" : "people"} available
                  for test ownership.
                </p>
              </div>
              <button
                aria-label="Close team settings"
                className="detail-close"
                onClick={() => setSettingsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>

            <div className="team-list">
              {review.teamMembers.length > 0 ? (
                review.teamMembers.map((member) => (
                  <div className="team-row" key={member.id}>
                    <span className="avatar-chip team-avatar">
                      {getInitials(member.name)}
                    </span>
                    <span className="team-copy">
                      <strong>{member.name}</strong>
                      <span>{member.role || "No role set"}</span>
                    </span>
                    <button
                      aria-label={`Remove ${member.name}`}
                      className="detail-close"
                      disabled={busy}
                      onClick={() => deleteTeamMember(member.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="team-empty">No teammates yet.</div>
              )}
            </div>

            <div className="team-form">
              <label className="field-group">
                <span className="eyebrow">Name</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setTeamDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Priya Shah"
                  value={teamDraft.name}
                />
              </label>
              <label className="field-group">
                <span className="eyebrow">Role</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setTeamDraft((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  placeholder="e.g. Product lead"
                  value={teamDraft.role}
                />
              </label>
              <button
                className="primary-button"
                disabled={busy || !teamDraft.name.trim()}
                onClick={addTeamMember}
                type="button"
              >
                <Plus aria-hidden="true" size={14} />
                Add teammate
              </button>
            </div>

            {settingsMessage ? (
              <p className="modal-message">{settingsMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {treeOpen ? (
        <div
          className="modal-scrim drawer-scrim"
          onClick={closeTreeDrawer}
          role="presentation"
        >
          <div
            className="tree-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div>
                <h3>Full tree</h3>
                <p>
                  Outcome first, then opportunities. Open an opportunity to see its solutions.
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  className="detail-close"
                  onClick={closeTreeDrawer}
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </div>
            </div>

            {treeMessage ? <p className="modal-message">{treeMessage}</p> : null}

            {movingTreeTest ? (
              <div className="tree-move-banner">
                <MoveRight aria-hidden="true" size={16} />
                <div>
                  <strong>Move this test to another assumption</strong>
                  <span>{movingTreeTest.test || "Untitled test"}</span>
                </div>
                <button
                  className="secondary-button compact"
                  onClick={() => {
                    setMoveTestId(null);
                    setTreeMessage("");
                  }}
                  type="button"
                >
                  Done
                </button>
              </div>
            ) : null}

            <div className="tree-branch">
              {renderTreeRow(treeOutcome, {
                active: false,
                depth: 0,
              })}
            </div>

            <div
              className="tree-child-stack"
              style={
                {
                  "--tree-depth": "1",
                  "--tree-offset": "18px",
                } as CSSProperties
              }
            >
              {getTreeChildren(treeOutcome.id, "opportunity").map((opportunity) =>
                renderOpportunityBranch(opportunity, 1),
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
