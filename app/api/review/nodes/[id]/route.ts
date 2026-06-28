import {
  deleteNodeRecord,
  QaFixtureDataError,
  updateNodeRecord,
} from "@/lib/review-data";
import type { AssumptionType, SolutionStatus } from "@/lib/review-data";

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
      title?: string;
      description?: string;
      reviewPriority?: number;
      assumptionType?: AssumptionType;
      isFocus?: boolean;
      status?: SolutionStatus;
    };

    await updateNodeRecord(id, payload);
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
    await deleteNodeRecord(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: toRouteErrorStatus(error) },
    );
  }
}
