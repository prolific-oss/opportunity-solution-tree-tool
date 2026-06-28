import ReviewClient from "@/app/review-client";
import { getReviewState } from "@/lib/review-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const initialReview = await getReviewState();
  return <ReviewClient initialReview={initialReview} />;
}
