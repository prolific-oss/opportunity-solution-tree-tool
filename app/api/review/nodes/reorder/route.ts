import { reorderNodeRecord } from "@/lib/review-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRouteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      nodeId?: string;
      targetNodeId?: string;
      placement?: "before" | "after";
    };

    const nodeId = payload.nodeId?.trim() ?? "";
    const targetNodeId = payload.targetNodeId?.trim() ?? "";
    const placement = payload.placement === "after" ? "after" : "before";

    if (!nodeId || !targetNodeId) {
      return Response.json(
        { error: "nodeId and targetNodeId are required" },
        { status: 400 },
      );
    }

    await reorderNodeRecord({ nodeId, targetNodeId, placement });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 },
    );
  }
}
