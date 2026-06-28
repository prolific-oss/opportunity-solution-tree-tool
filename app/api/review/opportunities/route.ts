import { createOpportunityRecord } from "@/lib/review-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRouteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      title?: string;
      description?: string;
      parentId?: string;
    };

    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    const parentId = payload.parentId?.trim() ?? undefined;

    if (!title) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    const opportunity = await createOpportunityRecord({
      title,
      description,
      parentId,
    });
    return Response.json({ opportunity }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 },
    );
  }
}
