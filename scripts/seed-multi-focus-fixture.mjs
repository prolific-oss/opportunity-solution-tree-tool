const baseUrl = process.argv[2] ?? process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:3000";

const fixture = [
  {
    opportunity: "QA: Confidence before launch",
    solution: "QA: Filter by activity",
    assumption:
      "QA: Activity filters help teams predict whether audiences are engaged enough.",
    test: "QA: Compare confidence before and after reviewing activity-filter results.",
  },
  {
    opportunity: "QA: Right-sized audience selection",
    solution: "QA: Natural-language audience discovery",
    assumption:
      "QA: Teams can express audience intent faster in natural language than filters.",
    test: "QA: Run a moderated task where a user describes an audience and selects a match.",
  },
  {
    opportunity: "QA: Reusable audience sets",
    solution: "QA: Reusable filter set templates",
    assumption:
      "QA: Teams reuse popular filter sets when provenance and usage are visible.",
    test: "QA: Smoke test template-gallery naming and reuse intent.",
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    throw new Error(
      payload.error ??
        `${options.method ?? "GET"} ${path} failed with ${response.status}`,
    );
  }

  return payload.review ?? payload;
}

async function getReview() {
  return request("/api/review");
}

function findTreeNode(review, predicate) {
  return review.tree.find(predicate);
}

async function focusNode(nodeId) {
  await request(`/api/review/nodes/${nodeId}`, {
    method: "PATCH",
    body: JSON.stringify({ isFocus: true }),
  });
}

async function ensureOpportunity(review, title) {
  const existing = findTreeNode(
    review,
    (node) => node.type === "opportunity" && node.title === title,
  );

  if (existing) {
    await focusNode(existing.id);
    return existing.id;
  }

  const payload = await request("/api/review/opportunities", {
    method: "POST",
    body: JSON.stringify({
      parentId: review.outcome.id,
      title,
      description: "Disposable multi-focus visual QA fixture.",
    }),
  });
  await focusNode(payload.opportunity.id);
  return payload.opportunity.id;
}

async function ensureSolution(review, parentId, title) {
  const existing = findTreeNode(
    review,
    (node) =>
      node.type === "solution" && node.parentId === parentId && node.title === title,
  );

  if (existing) {
    await focusNode(existing.id);
    return existing.id;
  }

  const payload = await request("/api/review/solutions", {
    method: "POST",
    body: JSON.stringify({
      parentId,
      title,
      description: "Disposable multi-focus visual QA fixture.",
    }),
  });
  await focusNode(payload.solution.id);
  return payload.solution.id;
}

async function ensureAssumption(review, solutionId, title) {
  const existing = review.assumptions.find(
    (assumption) => assumption.solutionId === solutionId && assumption.title === title,
  );

  if (existing) {
    return existing.id;
  }

  const payload = await request("/api/review/assumptions", {
    method: "POST",
    body: JSON.stringify({
      solutionId,
      title,
      assumptionType: "desirability",
    }),
  });
  return payload.assumption.id;
}

async function ensureTest(review, assumptionNodeId, testDescription) {
  const existing = review.tests.find(
    (test) =>
      test.assumptionNodeId === assumptionNodeId && test.test === testDescription,
  );

  if (existing) {
    return existing.id;
  }

  const payload = await request("/api/review/tests", {
    method: "POST",
    body: JSON.stringify({
      assumptionNodeId,
      testDescription,
      successCriteria: "Clear visual QA signal.",
      owner: "QA",
      dueDate: "2026-07-03",
    }),
  });
  return payload.test.id;
}

async function main() {
  let review = await getReview();

  for (const item of fixture) {
    const opportunityId = await ensureOpportunity(review, item.opportunity);
    review = await getReview();

    const solutionId = await ensureSolution(review, opportunityId, item.solution);
    review = await getReview();

    const assumptionId = await ensureAssumption(
      review,
      solutionId,
      item.assumption,
    );
    review = await getReview();

    await ensureTest(review, assumptionId, item.test);
    review = await getReview();
  }

  const focusedSummary = review.solutions
    .map((solution) => `- ${solution.name} (${solution.opportunityTitle})`)
    .join("\n");

  console.log(`Seeded multi-focus fixture at ${baseUrl}`);
  console.log(`Focused solutions:\n${focusedSummary}`);
  console.log(`Queue tests: ${review.tests.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
