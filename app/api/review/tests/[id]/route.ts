import {
  deleteTestRecord,
  QaFixtureDataError,
  updateTestRecord,
} from "@/lib/review-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRouteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

function toRouteErrorStatus(error: unknown) {
  return error instanceof QaFixtureDataError ? 400 : 500;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as {
      assumptionNodeId?: string;
      assumptionTitle?: string;
      assumptionType?:
        | "desirability"
        | "feasibility"
        | "usability"
        | "viability"
        | "ethical";
      owner?: string;
      ownerRole?: string;
      dueDate?: string;
      status?: "not_started" | "in_progress" | "done";
      testDescription?: string;
      successCriteria?: string;
      progressNotes?: string;
      verdict?: "" | "validated" | "invalidated";
      evidence?: string;
    };

    await updateTestRecord(id, payload);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: toRouteErrorStatus(error) },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteTestRecord(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: toRouteErrorStatus(error) },
    );
  }
}
