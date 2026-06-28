import { createTestRecord } from "@/lib/review-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRouteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      assumptionNodeId?: string;
      testDescription?: string;
      successCriteria?: string;
      owner?: string;
      dueDate?: string;
    };

    const assumptionNodeId = payload.assumptionNodeId?.trim() ?? "";
    const testDescription = payload.testDescription?.trim() ?? "";

    if (!assumptionNodeId || !testDescription) {
      return Response.json(
        { error: "assumptionNodeId and testDescription are required" },
        { status: 400 },
      );
    }

    const test = await createTestRecord({
      assumptionNodeId,
      testDescription,
      successCriteria: payload.successCriteria ?? "",
      owner: payload.owner ?? "",
      dueDate: payload.dueDate ?? "",
    });

    return Response.json({ test }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 },
    );
  }
}
