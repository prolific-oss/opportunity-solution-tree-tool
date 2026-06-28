import {
  createTeamMemberRecord,
  deleteTeamMemberRecord,
} from "@/lib/review-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRouteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      role?: string;
    };

    await createTeamMemberRecord({
      name: payload.name ?? "",
      role: payload.role ?? "",
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") ?? "";

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    await deleteTeamMemberRecord(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: toRouteErrorMessage(error) },
      { status: 500 },
    );
  }
}
