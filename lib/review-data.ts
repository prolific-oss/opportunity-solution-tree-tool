import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureReviewStorage } from "@/db/bootstrap";
import { assumptionTests, ostNodes, outcomeMetrics, teamMembers } from "@/db/schema";

export type TestStatus = "not_started" | "in_progress" | "done";
export type SolutionStatus = "active" | "completed";
export type AssumptionType =
  | "desirability"
  | "feasibility"
  | "usability"
  | "viability"
  | "ethical";
export type Verdict = "" | "validated" | "invalidated";

export type ReviewPathNode = {
  id: string;
  type: "Outcome" | "Opportunity";
  title: string;
  description: string;
  siblingLabel?: string;
  active?: boolean;
};

export type ReviewTreeNode = {
  id: string;
  parentId: string | null;
  outcomeId: string;
  type: "outcome" | "opportunity" | "solution" | "assumption";
  title: string;
  description: string;
  assumptionType?: AssumptionType;
  status?: SolutionStatus;
  rank: number;
  active: boolean;
  isFocus: boolean;
};

export type ReviewSolution = {
  id: string;
  parentId: string | null;
  outcomeId: string;
  rank: number;
  name: string;
  description: string;
  shortName: string;
  status: SolutionStatus;
  reviewPriority: number;
  isFocus: boolean;
};

export type ReviewAssumption = {
  id: string;
  solutionId: string;
  solutionName: string;
  title: string;
  assumptionType: AssumptionType;
  rank: number;
  reviewPriority: number;
};

export type ReviewTest = {
  id: string;
  assumptionNodeId: string;
  solutionId: string;
  solutionName: string;
  assumptionType: AssumptionType;
  assumption: string;
  test: string;
  successCriteria: string;
  owner: string;
  role: string;
  dueDate: string;
  status: TestStatus;
  progress: string;
  verdict: Verdict;
  evidence: string;
  rank: number;
  reviewPriority: number;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
};

export type ReviewState = {
  reviewLabel: string;
  outcome: {
    id: string;
    title: string;
    description: string;
    metrics: string[];
  };
  focusOpportunity: {
    id: string;
    title: string;
    description: string;
  };
  path: ReviewPathNode[];
  tree: ReviewTreeNode[];
  solutions: ReviewSolution[];
  assumptions: ReviewAssumption[];
  tests: ReviewTest[];
  teamMembers: TeamMember[];
};

const OUTCOME_ID = "outcome-help-ai-teams-launch-with-confidence";
const ROOT_OPPORTUNITY_ID = "opp-relevant-engaged-high-quality";
const FOCUS_OPPORTUNITY_ID = "opp-see-existing-pool-engagement";
const SEED_SOLUTION_ID = "solution-activity-insights-pgs-ui";
// Focus is stored as lineage membership: one terminal opportunity, plus up to
// three terminal solutions, with each focused node's ancestors also marked.
const MAX_FOCUSED_SOLUTIONS = 3;

let assumptionTypesBackfilled = false;

const seedMetrics = [
  "Increase % of studies launched with x% or higher ratio of 7-day-active to eligible participants",
  "Increase % of studies launched with 10% or lower ratio of eligible-to-places-requested",
  "Increase % of data collectors who publish after applying at least 1 gate (screeners, participant groups, sampling)",
  "Get at least 4 out of 5 rating for ease-of-use for audience selection (using in-app surveys e.g. if they didn't publish, or even if they did publish)",
  "PfAI: Active Customers x Completed Studies per Month x Mean study Value",
];

const seedAssumptions = [
  {
    title:
      "We have provided enough insights to prevent multi-sheet and third party tool analysis/insight gathering off platform",
    testDescription:
      "Review activity insights with Services teammates and compare whether it replaces spreadsheet or Metabase work.",
    successCriteria:
      "Confirmation from at least 3 Services team members that activity insights has helped reduce spreadsheet/metabase burden.",
  },
  {
    title: "Frontier AI will actually USE the activity insights to inform their work",
  },
  {
    title: "DCs care about the insights and NOT just need fill time insights",
  },
  {
    title: "Services will actually USE the activity insights to inform their work",
  },
  {
    title: "PG Hub insights ultimately help speed up time to launch",
  },
  {
    title: "DCs want to re-use PGs if they had the insights to support",
  },
  {
    title:
      "DCs want activity insights to be globally-scoped, not workspace- nor study-scoped",
  },
  {
    title:
      "We're going to use the right statistics and cadence first time and not have to re-visit any technical decisions",
  },
  {
    title:
      "DCs want insights and automation of actions, not just automation of actions only",
  },
  {
    title:
      "We provide metrics and insights that the user didn't realise they needed but now depend on to make better judgement",
  },
];

function shortNameFromTitle(title: string) {
  return title.trim().split(/\s+/).slice(0, 2).join(" ");
}

function compareByPriority(
  left: { reviewPriority: number; sortOrder: number },
  right: { reviewPriority: number; sortOrder: number },
) {
  if (left.reviewPriority !== right.reviewPriority) {
    return left.reviewPriority - right.reviewPriority;
  }

  return left.sortOrder - right.sortOrder;
}

function siblingLabelForNode(
  nodeId: string,
  nodeType: "opportunity" | "solution",
  parentId: string | null,
  nodes: Array<typeof ostNodes.$inferSelect>,
) {
  const siblings = nodes.filter(
    (node) =>
      node.nodeType === nodeType &&
      node.parentId === parentId &&
      node.id !== nodeId,
  ).length;

  if (siblings < 1) {
    return undefined;
  }

  const label =
    nodeType === "opportunity"
      ? siblings === 1
        ? "sibling opportunity"
        : "sibling opportunities"
      : siblings === 1
        ? "sibling solution"
        : "sibling solutions";

  return `+${siblings} ${label} · collapsed`;
}

function reviewLabelForToday() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);

  return `Week of ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(monday)}`;
}

function defaultAssumptionType(
  value: string | null | undefined,
): AssumptionType {
  if (
    value === "desirability" ||
    value === "feasibility" ||
    value === "usability" ||
    value === "viability" ||
    value === "ethical"
  ) {
    return value;
  }

  return "desirability";
}

function solutionStatusFromNode(status: string | null | undefined): SolutionStatus {
  return status === "completed" ? "completed" : "active";
}

type OstNode = typeof ostNodes.$inferSelect;

function nodeDepth(node: OstNode, nodeMap: Map<string, OstNode>) {
  let depth = 0;
  let current: OstNode | undefined = node;

  while (current?.parentId) {
    depth += 1;
    current = nodeMap.get(current.parentId);
  }

  return depth;
}

function focusCompare(nodeMap: Map<string, OstNode>) {
  return (left: OstNode, right: OstNode) => {
    const depthCompare = nodeDepth(right, nodeMap) - nodeDepth(left, nodeMap);
    if (depthCompare !== 0) {
      return depthCompare;
    }

    const priorityCompare = compareByPriority(left, right);
    if (priorityCompare !== 0) {
      return priorityCompare;
    }

    return left.id.localeCompare(right.id);
  };
}

function isDescendantOf(
  node: OstNode,
  ancestorId: string,
  nodeMap: Map<string, OstNode>,
) {
  let current: OstNode | undefined = node;

  while (current?.parentId) {
    if (current.parentId === ancestorId) {
      return true;
    }

    current = nodeMap.get(current.parentId);
  }

  return false;
}

function isNodeOrDescendantOf(
  node: OstNode,
  ancestorId: string,
  nodeMap: Map<string, OstNode>,
) {
  return node.id === ancestorId || isDescendantOf(node, ancestorId, nodeMap);
}

function ancestorFocusIds(node: OstNode, nodeMap: Map<string, OstNode>) {
  const ids = new Set<string>();
  let current: OstNode | undefined = node;

  while (current) {
    ids.add(current.id);
    current =
      current.parentId != null ? nodeMap.get(current.parentId) : undefined;
  }

  return ids;
}

function nearestOpportunityAncestor(node: OstNode, nodeMap: Map<string, OstNode>) {
  let current: OstNode | undefined =
    node.nodeType === "opportunity"
      ? node
      : node.parentId != null
        ? nodeMap.get(node.parentId)
        : undefined;

  while (current && current.nodeType !== "opportunity") {
    current =
      current.parentId != null ? nodeMap.get(current.parentId) : undefined;
  }

  return current;
}

function deepestFocusedOpportunity(nodes: OstNode[], nodeMap: Map<string, OstNode>) {
  return (
    nodes
      .filter((node) => node.nodeType === "opportunity" && node.isFocus)
      .sort(focusCompare(nodeMap))[0] ??
    nodeMap.get(FOCUS_OPPORTUNITY_ID) ??
    nodes.filter((node) => node.nodeType === "opportunity").sort(compareByPriority)[0]
  );
}

function terminalFocusedSolutions(nodes: OstNode[], nodeMap: Map<string, OstNode>) {
  const focusedSolutions = nodes.filter(
    (node) => node.nodeType === "solution" && node.isFocus,
  );

  return focusedSolutions
    .filter(
      (solution) =>
        !focusedSolutions.some(
          (other) =>
            other.id !== solution.id && isDescendantOf(other, solution.id, nodeMap),
        ),
    )
    .sort(compareByPriority);
}

async function persistFocusInvariant(
  outcomeId: string,
  focusOpportunity: OstNode | undefined,
  focusedSolutions: OstNode[],
) {
  const db = getDb();
  const nodes = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.outcomeId, outcomeId));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const focusIds = new Set<string>();

  if (focusOpportunity) {
    ancestorFocusIds(focusOpportunity, nodeMap).forEach((id) => focusIds.add(id));
  }

  focusedSolutions.forEach((solution) => {
    const current = nodeMap.get(solution.id);
    if (!current) {
      return;
    }

    ancestorFocusIds(current, nodeMap).forEach((id) => focusIds.add(id));
  });

  await db
    .update(ostNodes)
    .set({ isFocus: false })
    .where(eq(ostNodes.outcomeId, outcomeId));

  if (focusIds.size > 0) {
    await db
      .update(ostNodes)
      .set({ isFocus: true })
      .where(inArray(ostNodes.id, [...focusIds]));
  }
}

async function normalizeFocusState(outcomeId: string) {
  const db = getDb();
  const nodes = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.outcomeId, outcomeId));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const focusOpportunity = deepestFocusedOpportunity(nodes, nodeMap);
  const focusedSolutions = terminalFocusedSolutions(nodes, nodeMap)
    .filter((solution) =>
      focusOpportunity
        ? isNodeOrDescendantOf(solution, focusOpportunity.id, nodeMap)
        : true,
    )
    .slice(0, MAX_FOCUSED_SOLUTIONS);

  await persistFocusInvariant(outcomeId, focusOpportunity, focusedSolutions);
}

async function setOpportunityFocus(node: OstNode) {
  const db = getDb();
  const nodes = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.outcomeId, node.outcomeId));
  const nodeMap = new Map(nodes.map((current) => [current.id, current]));
  const focusedSolutions = terminalFocusedSolutions(nodes, nodeMap).filter((solution) =>
    isNodeOrDescendantOf(solution, node.id, nodeMap),
  );

  await persistFocusInvariant(node.outcomeId, node, focusedSolutions);
}

async function setSolutionFocus(node: OstNode, shouldFocus: boolean) {
  const db = getDb();
  const nodes = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.outcomeId, node.outcomeId));
  const nodeMap = new Map(nodes.map((current) => [current.id, current]));
  const focusOpportunity =
    nearestOpportunityAncestor(node, nodeMap) ?? deepestFocusedOpportunity(nodes, nodeMap);
  const focusedSolutions = terminalFocusedSolutions(nodes, nodeMap)
    .filter((solution) => solution.id !== node.id)
    .filter((solution) =>
      focusOpportunity
        ? isNodeOrDescendantOf(solution, focusOpportunity.id, nodeMap)
        : true,
    );

  if (shouldFocus) {
    if (focusedSolutions.length >= MAX_FOCUSED_SOLUTIONS) {
      throw new Error("Only three solutions can be in focus at once.");
    }

    focusedSolutions.push(node);
  }

  await persistFocusInvariant(
    node.outcomeId,
    focusOpportunity,
    focusedSolutions.sort(compareByPriority),
  );
}

async function backfillAssumptionTypes() {
  const db = getDb();
  const assumptions = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.nodeType, "assumption"));

  for (const assumption of assumptions) {
    if (assumption.assumptionType) {
      continue;
    }

    const [firstTest] = await db
      .select({ assumptionType: assumptionTests.assumptionType })
      .from(assumptionTests)
      .where(eq(assumptionTests.assumptionNodeId, assumption.id))
      .limit(1);

    await db
      .update(ostNodes)
      .set({
        assumptionType: defaultAssumptionType(firstTest?.assumptionType),
      })
      .where(eq(ostNodes.id, assumption.id));
  }
}

async function backfillTeamMembersFromOwners() {
  const db = getDb();
  const tests = await db.select().from(assumptionTests);
  const members = await db.select().from(teamMembers);
  const existingNames = new Set(
    members.map((member) => member.name.trim().toLowerCase()).filter(Boolean),
  );
  let nextSortOrder =
    members.reduce((max, member) => Math.max(max, member.sortOrder), 0) + 1;

  for (const test of tests) {
    const owner = test.owner?.trim();
    if (!owner || existingNames.has(owner.toLowerCase())) {
      continue;
    }

    await db.insert(teamMembers).values({
      id: crypto.randomUUID(),
      name: owner,
      role: test.ownerRole?.trim() ?? "",
      sortOrder: nextSortOrder,
    });
    existingNames.add(owner.toLowerCase());
    nextSortOrder += 1;
  }
}

export async function ensureSeedData() {
  await ensureReviewStorage();
  const db = getDb();

  const [existingOutcome] = await db
    .select({ id: ostNodes.id })
    .from(ostNodes)
    .where(eq(ostNodes.id, OUTCOME_ID))
    .limit(1);

  if (existingOutcome) {
    if (!assumptionTypesBackfilled) {
      await backfillAssumptionTypes();
      await backfillTeamMembersFromOwners();
      assumptionTypesBackfilled = true;
    }
    await normalizeFocusState(OUTCOME_ID);
    return;
  }

  const pathNodes: Array<typeof ostNodes.$inferInsert> = [
    {
      id: OUTCOME_ID,
      outcomeId: OUTCOME_ID,
      parentId: null,
      nodeType: "outcome",
      title:
        "Help AI teams launch with confidence by making active, relevant audiences easy to find.",
      description: "We will have succeeded when the linked success metrics move.",
      sortOrder: 0,
      reviewPriority: 0,
      isFocus: true,
    },
    {
      id: ROOT_OPPORTUNITY_ID,
      outcomeId: OUTCOME_ID,
      parentId: OUTCOME_ID,
      nodeType: "opportunity",
      title:
        "AI teams struggle to find audiences that are relevant, engaged and high quality enough to provide GOOD data QUICKLY",
      description: "",
      sortOrder: 0,
      reviewPriority: 1,
      isFocus: false,
    },
    {
      id: FOCUS_OPPORTUNITY_ID,
      outcomeId: OUTCOME_ID,
      parentId: ROOT_OPPORTUNITY_ID,
      nodeType: "opportunity",
      title:
        "AI teams struggle to see, before launch, how engaged their existing participant pools will be",
      description: "",
      sortOrder: 0,
      reviewPriority: 1,
      isFocus: true,
    },
    {
      id: SEED_SOLUTION_ID,
      outcomeId: OUTCOME_ID,
      parentId: FOCUS_OPPORTUNITY_ID,
      nodeType: "solution",
      title: "Provide activity insights on PGs in the UI",
      description: "",
      sortOrder: 0,
      reviewPriority: 1,
      isFocus: true,
    },
  ];

  const assumptionNodes: Array<typeof ostNodes.$inferInsert> = seedAssumptions.map(
    (assumption, index) => ({
      id: `assumption-${index + 1}`,
      outcomeId: OUTCOME_ID,
      parentId: SEED_SOLUTION_ID,
      nodeType: "assumption" as const,
      title: assumption.title,
      description: "",
      assumptionType: "desirability" as const,
      sortOrder: index,
      reviewPriority: index + 1,
      isFocus: false,
    }),
  );

  await db.insert(ostNodes).values(pathNodes);
  await db.insert(ostNodes).values(assumptionNodes);
  await normalizeFocusState(OUTCOME_ID);

  await db.insert(outcomeMetrics).values(
    seedMetrics.map((title, index) => ({
      id: `metric-${index + 1}`,
      outcomeId: OUTCOME_ID,
      title,
      sortOrder: index,
    })),
  );

  await db.insert(assumptionTests).values({
    id: "test-seed-1",
    assumptionNodeId: "assumption-1",
    solutionNodeId: SEED_SOLUTION_ID,
    title: seedAssumptions[0].title,
    status: "not_started",
    assumptionType: "desirability",
    owner: "",
    ownerRole: "",
    dueDate: "",
    testDescription: seedAssumptions[0].testDescription,
    successCriteria: seedAssumptions[0].successCriteria,
    progressNotes: "",
    verdict: null,
    evidence: "",
    result: "",
    sortOrder: 0,
    reviewPriority: 1,
  });

  await backfillTeamMembersFromOwners();
  assumptionTypesBackfilled = true;
}

export async function getReviewState(): Promise<ReviewState> {
  await ensureSeedData();
  const db = getDb();

  const nodes = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.outcomeId, OUTCOME_ID))
    .orderBy(asc(ostNodes.sortOrder), asc(ostNodes.reviewPriority));

  const metrics = await db
    .select()
    .from(outcomeMetrics)
    .where(eq(outcomeMetrics.outcomeId, OUTCOME_ID))
    .orderBy(asc(outcomeMetrics.sortOrder));

  const tests = await db
    .select()
    .from(assumptionTests)
    .orderBy(asc(assumptionTests.sortOrder), asc(assumptionTests.reviewPriority));

  const members = await db
    .select()
    .from(teamMembers)
    .orderBy(asc(teamMembers.name), asc(teamMembers.id));

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const outcomeNode = nodeMap.get(OUTCOME_ID);

  if (!outcomeNode) {
    throw new Error("Outcome node is missing.");
  }

  const focusOpportunity = deepestFocusedOpportunity(nodes, nodeMap);

  if (!focusOpportunity) {
    throw new Error("Focused opportunity is missing.");
  }

  const path: ReviewPathNode[] = [];
  let currentNode: typeof ostNodes.$inferSelect | undefined = focusOpportunity;

  while (currentNode) {
    path.unshift({
      id: currentNode.id,
      type:
        currentNode.nodeType === "outcome"
          ? "Outcome"
          : "Opportunity",
      title: currentNode.title,
      description: currentNode.description ?? "",
      siblingLabel:
        currentNode.nodeType === "opportunity"
          ? siblingLabelForNode(
              currentNode.id,
              "opportunity",
              currentNode.parentId,
              nodes,
            )
          : undefined,
      active: currentNode.id === focusOpportunity.id,
    });

    currentNode =
      currentNode.parentId != null
        ? nodeMap.get(currentNode.parentId)
        : undefined;
  }

  function isDescendantNode(node: typeof ostNodes.$inferSelect, ancestorId: string) {
    let current = node;

    while (current.parentId) {
      if (current.parentId === ancestorId) {
        return true;
      }

      const parent = nodeMap.get(current.parentId);
      if (!parent) {
        return false;
      }

      current = parent;
    }

    return false;
  }

  const descendantSolutionNodes = nodes
    .filter(
      (node) =>
        node.nodeType === "solution" && isDescendantNode(node, focusOpportunity.id),
    )
    .sort(compareByPriority);
  const focusedSolutionNodes = terminalFocusedSolutions(nodes, nodeMap)
    .filter((node) => isDescendantNode(node, focusOpportunity.id))
    .sort(compareByPriority)
    .slice(0, MAX_FOCUSED_SOLUTIONS);
  const solutionNodes =
    focusedSolutionNodes.length > 0
      ? focusedSolutionNodes
      : descendantSolutionNodes.slice(0, MAX_FOCUSED_SOLUTIONS);

  const pathNodeIds = new Set(path.map((node) => node.id));
  const treeRankMap = new Map<string, number>();
  const treeGroups = new Map<string, Array<typeof ostNodes.$inferSelect>>();

  nodes.forEach((node) => {
    const key = `${node.parentId ?? "root"}::${node.nodeType}`;
    const group = treeGroups.get(key) ?? [];
    group.push(node);
    treeGroups.set(key, group);
  });

  treeGroups.forEach((group) => {
    group.sort(compareByPriority).forEach((node, index) => {
      treeRankMap.set(node.id, index + 1);
    });
  });

  const reviewTree: ReviewTreeNode[] = nodes
    .slice()
    .sort((left, right) => {
      const leftParent = left.parentId ?? "";
      const rightParent = right.parentId ?? "";

      if (leftParent !== rightParent) {
        return leftParent.localeCompare(rightParent);
      }

      if (left.nodeType !== right.nodeType) {
        return left.nodeType.localeCompare(right.nodeType);
      }

      return compareByPriority(left, right);
    })
    .map((node) => ({
      id: node.id,
      parentId: node.parentId,
      outcomeId: node.outcomeId,
      type: node.nodeType,
      title: node.title,
      description: node.description ?? "",
      assumptionType: defaultAssumptionType(node.assumptionType),
      status:
        node.nodeType === "solution" ? solutionStatusFromNode(node.status) : undefined,
      rank: treeRankMap.get(node.id) ?? 1,
      active: pathNodeIds.has(node.id) || node.isFocus,
      isFocus: node.isFocus,
    }));

  const reviewSolutions: ReviewSolution[] = solutionNodes.map((solution, index) => ({
    id: solution.id,
    parentId: solution.parentId,
    outcomeId: solution.outcomeId,
    rank: index + 1,
    name: solution.title,
    description: solution.description ?? "",
    shortName: shortNameFromTitle(solution.title),
    status: solutionStatusFromNode(solution.status),
    reviewPriority: solution.reviewPriority,
    isFocus: solution.isFocus,
  }));

  const solutionIds = reviewSolutions.map((solution) => solution.id);
  const solutionNameMap = new Map(
    reviewSolutions.map((solution) => [solution.id, solution.name]),
  );
  const solutionRankMap = new Map(
    reviewSolutions.map((solution) => [solution.id, solution.rank]),
  );

  const visibleAssumptionNodes = nodes
    .filter(
      (node) =>
        node.nodeType === "assumption" &&
        node.parentId != null &&
        solutionIds.includes(node.parentId),
    )
    .sort((left, right) => {
      const leftSolutionRank = solutionRankMap.get(left.parentId ?? "") ?? 999;
      const rightSolutionRank = solutionRankMap.get(right.parentId ?? "") ?? 999;

      if (leftSolutionRank !== rightSolutionRank) {
        return leftSolutionRank - rightSolutionRank;
      }

      return compareByPriority(left, right);
    });

  const firstTestByAssumption = new Map<
    string,
    (typeof assumptionTests.$inferSelect)[]
  >();

  tests.forEach((test) => {
    const list = firstTestByAssumption.get(test.assumptionNodeId) ?? [];
    list.push(test);
    firstTestByAssumption.set(test.assumptionNodeId, list);
  });

  const reviewAssumptions: ReviewAssumption[] = visibleAssumptionNodes.map(
    (assumptionNode, index) => ({
      id: assumptionNode.id,
      solutionId: assumptionNode.parentId ?? "",
      solutionName: solutionNameMap.get(assumptionNode.parentId ?? "") ?? "Solution",
      title: assumptionNode.title,
      assumptionType: defaultAssumptionType(
        assumptionNode.assumptionType ??
          firstTestByAssumption.get(assumptionNode.id)?.[0]?.assumptionType,
      ),
      rank: index + 1,
      reviewPriority: assumptionNode.reviewPriority,
    }),
  );

  const assumptionTitleMap = new Map(
    reviewAssumptions.map((assumption) => [assumption.id, assumption.title]),
  );
  const assumptionTypeMap = new Map(
    reviewAssumptions.map((assumption) => [assumption.id, assumption.assumptionType]),
  );
  const assumptionSortMap = new Map(
    visibleAssumptionNodes.map((assumption) => [assumption.id, assumption]),
  );

  const reviewTests = tests
    .filter((test) => solutionIds.includes(test.solutionNodeId))
    .sort((left, right) => {
      const leftSolutionRank = solutionRankMap.get(left.solutionNodeId) ?? 999;
      const rightSolutionRank = solutionRankMap.get(right.solutionNodeId) ?? 999;

      if (leftSolutionRank !== rightSolutionRank) {
        return leftSolutionRank - rightSolutionRank;
      }

      const leftAssumption = assumptionSortMap.get(left.assumptionNodeId);
      const rightAssumption = assumptionSortMap.get(right.assumptionNodeId);

      if (leftAssumption && rightAssumption) {
        const assumptionCompare = compareByPriority(leftAssumption, rightAssumption);
        if (assumptionCompare !== 0) {
          return assumptionCompare;
        }
      }

      return compareByPriority(left, right);
    })
    .map((test, index) => ({
      id: test.id,
      assumptionNodeId: test.assumptionNodeId,
      solutionId: test.solutionNodeId,
      solutionName: solutionNameMap.get(test.solutionNodeId) ?? "Solution",
      assumptionType: defaultAssumptionType(
        assumptionTypeMap.get(test.assumptionNodeId) ?? test.assumptionType,
      ),
      assumption: assumptionTitleMap.get(test.assumptionNodeId) ?? test.title,
      test: test.testDescription ?? "",
      successCriteria: test.successCriteria ?? "",
      owner: test.owner ?? "",
      role: test.ownerRole ?? "",
      dueDate: test.dueDate ?? "",
      status: test.status,
      progress: test.progressNotes ?? "",
      verdict: (test.verdict ?? "") as Verdict,
      evidence: test.evidence ?? "",
      rank: index + 1,
      reviewPriority: test.reviewPriority,
    }));

  return {
    reviewLabel: reviewLabelForToday(),
    outcome: {
      id: outcomeNode.id,
      title: outcomeNode.title,
      description: outcomeNode.description ?? "",
      metrics: metrics.map((metric) => metric.title),
    },
    focusOpportunity: {
      id: focusOpportunity.id,
      title: focusOpportunity.title,
      description: focusOpportunity.description ?? "",
    },
    path,
    tree: reviewTree,
    solutions: reviewSolutions,
    assumptions: reviewAssumptions,
    tests: reviewTests,
    teamMembers: members.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role ?? "",
    })),
  };
}

async function nextNodePriority(parentId: string, nodeType: "opportunity" | "solution" | "assumption") {
  const db = getDb();
  const siblings = await db
    .select({
      reviewPriority: ostNodes.reviewPriority,
      sortOrder: ostNodes.sortOrder,
    })
    .from(ostNodes)
    .where(and(eq(ostNodes.parentId, parentId), eq(ostNodes.nodeType, nodeType)));

  return (
    siblings.reduce(
      (max, sibling) => Math.max(max, sibling.sortOrder, sibling.reviewPriority),
      0,
    ) + 1
  );
}

export async function createOpportunityRecord(input: {
  title: string;
  description: string;
  parentId?: string;
}) {
  await ensureSeedData();
  const db = getDb();
  const parentId = input.parentId?.trim() || ROOT_OPPORTUNITY_ID;
  const title = input.title.trim();
  const description = input.description.trim();

  const [parent] = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.id, parentId))
    .limit(1);

  if (
    !parent ||
    (parent.nodeType !== "outcome" && parent.nodeType !== "opportunity")
  ) {
    throw new Error("Opportunity parent not found.");
  }

  if (parent.nodeType === "opportunity") {
    const childSolutions = await db
      .select({ id: ostNodes.id })
      .from(ostNodes)
      .where(and(eq(ostNodes.parentId, parentId), eq(ostNodes.nodeType, "solution")));

    if (childSolutions.length > 0) {
      throw new Error("This opportunity already branches into solutions.");
    }
  }

  const nextOrder = await nextNodePriority(parentId, "opportunity");
  const id = crypto.randomUUID();

  await db.insert(ostNodes).values({
    id,
    outcomeId: parent.outcomeId,
    parentId,
    nodeType: "opportunity",
    title,
    description,
    sortOrder: nextOrder,
    reviewPriority: nextOrder,
    isFocus: false,
  });

  return {
    id,
    parentId,
    outcomeId: parent.outcomeId,
    title,
    description,
    reviewPriority: nextOrder,
  };
}

export async function createSolutionRecord(input: {
  title: string;
  description: string;
  parentId?: string;
}) {
  await ensureSeedData();
  const db = getDb();
  const title = input.title.trim();
  const description = input.description.trim();

  const nodes = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.outcomeId, OUTCOME_ID));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const focusOpportunity = deepestFocusedOpportunity(nodes, nodeMap);

  const parentId = input.parentId?.trim() || focusOpportunity?.id || FOCUS_OPPORTUNITY_ID;

  const [parent] = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.id, parentId))
    .limit(1);

  if (!parent || (parent.nodeType !== "opportunity" && parent.nodeType !== "solution")) {
    throw new Error("Solution parent not found.");
  }

  if (parent.nodeType === "opportunity") {
    const childOpportunities = await db
      .select({ id: ostNodes.id })
      .from(ostNodes)
      .where(
        and(eq(ostNodes.parentId, parentId), eq(ostNodes.nodeType, "opportunity")),
      );

    if (childOpportunities.length > 0) {
      throw new Error("This opportunity already branches into sub-opportunities.");
    }
  }

  if (parent.nodeType === "solution") {
    const childAssumptions = await db
      .select({ id: ostNodes.id })
      .from(ostNodes)
      .where(and(eq(ostNodes.parentId, parentId), eq(ostNodes.nodeType, "assumption")));

    if (childAssumptions.length > 0) {
      throw new Error("This solution already branches into assumptions.");
    }
  }

  const nextOrder = await nextNodePriority(parentId, "solution");
  const id = crypto.randomUUID();

  await db.insert(ostNodes).values({
    id,
    outcomeId: parent.outcomeId,
    parentId,
    nodeType: "solution",
    title,
    description,
    sortOrder: nextOrder,
    reviewPriority: nextOrder,
    isFocus: false,
  });

  return {
    id,
    parentId,
    outcomeId: parent.outcomeId,
    rank: nextOrder,
    name: title,
    description,
    shortName: shortNameFromTitle(title),
    status: "active",
    reviewPriority: nextOrder,
    isFocus: false,
  } satisfies ReviewSolution;
}

export async function createAssumptionRecord(input: {
  solutionId: string;
  title: string;
  assumptionType: AssumptionType;
}) {
  await ensureSeedData();
  const db = getDb();

  const [solution] = await db
    .select()
    .from(ostNodes)
    .where(and(eq(ostNodes.id, input.solutionId), eq(ostNodes.nodeType, "solution")))
    .limit(1);

  if (!solution) {
    throw new Error("Solution not found.");
  }

  const childSolutions = await db
    .select({ id: ostNodes.id })
    .from(ostNodes)
    .where(
      and(eq(ostNodes.parentId, input.solutionId), eq(ostNodes.nodeType, "solution")),
    );

  if (childSolutions.length > 0) {
    throw new Error("This solution already branches into sub-solutions.");
  }

  const nextOrder = await nextNodePriority(input.solutionId, "assumption");
  const id = crypto.randomUUID();
  const title = input.title.trim();

  await db.insert(ostNodes).values({
    id,
    outcomeId: solution.outcomeId,
    parentId: input.solutionId,
    nodeType: "assumption",
    title,
    description: "",
    assumptionType: input.assumptionType,
    sortOrder: nextOrder,
    reviewPriority: nextOrder,
    isFocus: false,
  });

  return {
    id,
    solutionId: input.solutionId,
    solutionName: solution.title,
    title,
    assumptionType: input.assumptionType,
    rank: nextOrder,
    reviewPriority: nextOrder,
  } satisfies ReviewAssumption;
}

export async function createTestRecord(input: {
  assumptionNodeId: string;
  testDescription: string;
  successCriteria: string;
  owner: string;
  dueDate: string;
}) {
  await ensureSeedData();
  const db = getDb();

  const [assumptionNode] = await db
    .select()
    .from(ostNodes)
    .where(
      and(
        eq(ostNodes.id, input.assumptionNodeId),
        eq(ostNodes.nodeType, "assumption"),
      ),
    )
    .limit(1);

  if (!assumptionNode || !assumptionNode.parentId) {
    throw new Error("Assumption not found.");
  }

  const [solutionNode] = await db
    .select()
    .from(ostNodes)
    .where(
      and(
        eq(ostNodes.id, assumptionNode.parentId),
        eq(ostNodes.nodeType, "solution"),
      ),
    )
    .limit(1);

  if (!solutionNode) {
    throw new Error("Solution not found.");
  }

  const siblingTests = await db
    .select({
      sortOrder: assumptionTests.sortOrder,
      reviewPriority: assumptionTests.reviewPriority,
    })
    .from(assumptionTests)
    .where(eq(assumptionTests.assumptionNodeId, input.assumptionNodeId));

  const nextOrder =
    siblingTests.reduce(
      (max, test) => Math.max(max, test.sortOrder, test.reviewPriority),
      0,
    ) + 1;
  const id = crypto.randomUUID();
  const testDescription = input.testDescription.trim();
  const successCriteria = input.successCriteria.trim();
  const owner = input.owner.trim();

  await db.insert(assumptionTests).values({
    id,
    assumptionNodeId: input.assumptionNodeId,
    solutionNodeId: assumptionNode.parentId,
    title: assumptionNode.title,
    status: "not_started",
    assumptionType: defaultAssumptionType(assumptionNode.assumptionType),
    owner,
    ownerRole: "",
    dueDate: input.dueDate,
    testDescription,
    successCriteria,
    progressNotes: "",
    verdict: null,
    evidence: "",
    result: "",
    sortOrder: nextOrder,
    reviewPriority: nextOrder,
  });

  return {
    id,
    assumptionNodeId: input.assumptionNodeId,
    solutionId: assumptionNode.parentId,
    solutionName: solutionNode.title,
    assumptionType: defaultAssumptionType(assumptionNode.assumptionType),
    assumption: assumptionNode.title,
    test: testDescription,
    successCriteria,
    owner,
    role: "",
    dueDate: input.dueDate,
    status: "not_started",
    progress: "",
    verdict: "",
    evidence: "",
    rank: nextOrder,
    reviewPriority: nextOrder,
  } satisfies ReviewTest;
}

export async function updateNodeRecord(
  nodeId: string,
  input: {
    title?: string;
    description?: string;
    reviewPriority?: number;
    assumptionType?: AssumptionType;
    isFocus?: boolean;
    status?: SolutionStatus;
  },
) {
  await ensureSeedData();
  const db = getDb();

  const [node] = await db
    .select()
    .from(ostNodes)
    .where(eq(ostNodes.id, nodeId))
    .limit(1);

  if (!node) {
    throw new Error("Node not found.");
  }

  const payload: Partial<typeof ostNodes.$inferInsert> = {};

  if (typeof input.title === "string") {
    payload.title = input.title.trim();
  }
  if (typeof input.description === "string") {
    payload.description = input.description.trim();
  }
  if (typeof input.reviewPriority === "number") {
    payload.reviewPriority = input.reviewPriority;
  }
  if (typeof input.assumptionType === "string") {
    payload.assumptionType = input.assumptionType;
  }
  if (typeof input.status === "string") {
    if (node.nodeType !== "solution") {
      throw new Error("Only solutions can be marked completed.");
    }

    payload.status = input.status === "completed" ? "completed" : null;
  }

  if (typeof input.isFocus === "boolean") {
    if (node.nodeType === "opportunity") {
      if (!input.isFocus) {
        throw new Error("An opportunity focus is required.");
      }

      await setOpportunityFocus(node);
    } else if (node.nodeType === "solution") {
      await setSolutionFocus(node, input.isFocus);
    } else {
      throw new Error("Only opportunities and solutions can become the focus.");
    }
  }

  if (Object.keys(payload).length > 0) {
    await db.update(ostNodes).set(payload).where(eq(ostNodes.id, nodeId));
  }

  if (node.nodeType === "assumption") {
    if (typeof input.title === "string") {
      await db
        .update(assumptionTests)
        .set({ title: input.title.trim() })
        .where(eq(assumptionTests.assumptionNodeId, nodeId));
    }

    if (typeof input.assumptionType === "string") {
      await db
        .update(assumptionTests)
        .set({ assumptionType: input.assumptionType })
        .where(eq(assumptionTests.assumptionNodeId, nodeId));
    }
  }
}

export async function reorderNodeRecord(input: {
  nodeId: string;
  targetNodeId: string;
  placement: "before" | "after";
}) {
  await ensureSeedData();
  const db = getDb();

  const nodes = await db
    .select()
    .from(ostNodes)
    .where(inArray(ostNodes.id, [input.nodeId, input.targetNodeId]));
  const node = nodes.find((entry) => entry.id === input.nodeId);
  const targetNode = nodes.find((entry) => entry.id === input.targetNodeId);

  if (!node || !targetNode) {
    throw new Error("Node not found.");
  }

  if (node.nodeType === "outcome" || targetNode.nodeType === "outcome") {
    throw new Error("The outcome cannot be reordered.");
  }

  if (
    node.id === targetNode.id ||
    node.parentId !== targetNode.parentId ||
    node.nodeType !== targetNode.nodeType ||
    !node.parentId
  ) {
    throw new Error("Items can only be reordered within their current sibling group.");
  }

  const siblings = await db
    .select()
    .from(ostNodes)
    .where(and(eq(ostNodes.parentId, node.parentId), eq(ostNodes.nodeType, node.nodeType)));

  const orderedSiblings = siblings.slice().sort(compareByPriority);
  const movingNode = orderedSiblings.find((entry) => entry.id === node.id);
  const withoutMovingNode = orderedSiblings.filter((entry) => entry.id !== node.id);
  const targetIndex = withoutMovingNode.findIndex(
    (entry) => entry.id === targetNode.id,
  );

  if (!movingNode || targetIndex < 0) {
    throw new Error("Could not place this item.");
  }

  const insertIndex =
    input.placement === "after" ? targetIndex + 1 : targetIndex;
  const reordered = [
    ...withoutMovingNode.slice(0, insertIndex),
    movingNode,
    ...withoutMovingNode.slice(insertIndex),
  ];

  for (const [index, sibling] of reordered.entries()) {
    const nextOrder = index + 1;
    await db
      .update(ostNodes)
      .set({ sortOrder: nextOrder, reviewPriority: nextOrder })
      .where(eq(ostNodes.id, sibling.id));
  }
}

export async function updateTestRecord(
  testId: string,
  input: {
    assumptionTitle?: string;
    assumptionType?: AssumptionType;
    owner?: string;
    ownerRole?: string;
    dueDate?: string;
    status?: TestStatus;
    testDescription?: string;
    successCriteria?: string;
    progressNotes?: string;
    verdict?: Verdict;
    evidence?: string;
  },
) {
  await ensureSeedData();
  const db = getDb();

  const [existing] = await db
    .select()
    .from(assumptionTests)
    .where(eq(assumptionTests.id, testId))
    .limit(1);

  if (!existing) {
    throw new Error("Assumption test not found.");
  }

  if (typeof input.assumptionTitle === "string") {
    await db
      .update(ostNodes)
      .set({ title: input.assumptionTitle.trim() })
      .where(eq(ostNodes.id, existing.assumptionNodeId));

    await db
      .update(assumptionTests)
      .set({ title: input.assumptionTitle.trim() })
      .where(eq(assumptionTests.assumptionNodeId, existing.assumptionNodeId));
  }

  if (typeof input.assumptionType === "string") {
    await db
      .update(ostNodes)
      .set({ assumptionType: input.assumptionType })
      .where(eq(ostNodes.id, existing.assumptionNodeId));

    await db
      .update(assumptionTests)
      .set({ assumptionType: input.assumptionType })
      .where(eq(assumptionTests.assumptionNodeId, existing.assumptionNodeId));
  }

  const payload: Partial<typeof assumptionTests.$inferInsert> = {};

  if (typeof input.owner === "string") {
    payload.owner = input.owner.trim();
  }
  if (typeof input.ownerRole === "string") {
    payload.ownerRole = input.ownerRole.trim();
  }
  if (typeof input.dueDate === "string") {
    payload.dueDate = input.dueDate;
  }
  if (typeof input.status === "string") {
    payload.status = input.status;
  }
  if (typeof input.testDescription === "string") {
    payload.testDescription = input.testDescription.trim();
  }
  if (typeof input.successCriteria === "string") {
    payload.successCriteria = input.successCriteria.trim();
  }
  if (typeof input.progressNotes === "string") {
    payload.progressNotes = input.progressNotes.trim();
  }
  if (typeof input.verdict === "string") {
    payload.verdict = input.verdict === "" ? null : input.verdict;
  }
  if (typeof input.evidence === "string") {
    payload.evidence = input.evidence.trim();
  }

  if (Object.keys(payload).length > 0) {
    await db.update(assumptionTests).set(payload).where(eq(assumptionTests.id, testId));
  }
}

export async function deleteTestRecord(testId: string) {
  await ensureSeedData();
  const db = getDb();
  await db.delete(assumptionTests).where(eq(assumptionTests.id, testId));
}

export async function createTeamMemberRecord(input: { name: string; role: string }) {
  await ensureSeedData();
  const db = getDb();
  const name = input.name.trim();
  const role = input.role.trim();

  if (!name) {
    throw new Error("Name is required.");
  }

  const members = await db.select().from(teamMembers);
  const duplicate = members.some(
    (member) => member.name.trim().toLowerCase() === name.toLowerCase(),
  );

  if (duplicate) {
    throw new Error("That teammate is already in the team.");
  }

  const nextOrder =
    members.reduce((max, member) => Math.max(max, member.sortOrder), 0) + 1;

  await db.insert(teamMembers).values({
    id: crypto.randomUUID(),
    name,
    role,
    sortOrder: nextOrder,
  });
}

export async function deleteTeamMemberRecord(memberId: string) {
  await ensureSeedData();
  const db = getDb();
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, memberId))
    .limit(1);

  if (!member) {
    return;
  }

  await db
    .update(assumptionTests)
    .set({ owner: "", ownerRole: "" })
    .where(eq(assumptionTests.owner, member.name));
  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));
}

export async function deleteNodeRecord(nodeId: string) {
  await ensureSeedData();
  const db = getDb();

  const nodes = await db.select().from(ostNodes);
  const node = nodes.find((entry) => entry.id === nodeId);

  if (!node || node.nodeType === "outcome") {
    return;
  }

  const descendants: Array<typeof ostNodes.$inferSelect> = [];
  const pending = nodes.filter((entry) => entry.parentId === nodeId);

  while (pending.length > 0) {
    const child = pending.shift();
    if (!child) {
      continue;
    }

    descendants.push(child);
    pending.push(...nodes.filter((entry) => entry.parentId === child.id));
  }

  const nodesToDelete = [node, ...descendants];
  const nodeIds = nodesToDelete.map((entry) => entry.id);
  const assumptionIds = nodesToDelete
    .filter((entry) => entry.nodeType === "assumption")
    .map((entry) => entry.id);

  if (assumptionIds.length > 0) {
    await db
      .delete(assumptionTests)
      .where(inArray(assumptionTests.assumptionNodeId, assumptionIds));
  }

  await db.delete(ostNodes).where(inArray(ostNodes.id, nodeIds));
}
