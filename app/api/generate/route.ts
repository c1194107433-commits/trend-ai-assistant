import { createGenerationHandler } from "@/lib/generation-server";

export const runtime = "nodejs";
export const maxDuration = 75;
export const dynamic = "force-dynamic";

export const POST = createGenerationHandler();
