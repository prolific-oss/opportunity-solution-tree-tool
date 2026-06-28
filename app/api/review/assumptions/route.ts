import { createAssumptionRecord } from "@/lib/review-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRouteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      solutionId?: string;
      title?: string;
      assumptionType?:
        | "desirability"
        | "feasibility"
        | "usability"
        | "viability"
        | "ethical";
    };

    const solutionId = payload.solutionId?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    const assumptionType = payload.assumptionType ?? "desirability";

    if (!solutionId || !title) {
      return Response.json(
        { error: "solutionId and title are required" },
        { status: 400 },
      );
    }

    const assumption = await createAssumptionRecord({
      solutionId,
      title,
      assumptionType,
    });
    return Response.json({ assumption }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 },
    );
  }
}
