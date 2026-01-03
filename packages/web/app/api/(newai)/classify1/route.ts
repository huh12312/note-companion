// app/app/api/(ai)/classify/route.ts
import { NextResponse, NextRequest } from "next/server";
import { classifyDocument } from "../aiService";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { incrementAndLogTokenUsage } from "@/lib/incrementAndLogTokenUsage";
import { getModel } from "@/lib/models";

/**
 * Document classification endpoint.
 *
 * NOTE: Despite the "1" suffix, this is the CURRENT and ONLY classification endpoint.
 * The name is kept as-is for backward compatibility with existing plugin installations.
 *
 * Plugin usage: packages/plugin/index.ts:837 - classifyContentV2() method
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, fileName, templateNames } = await request.json();
    const model = getModel();
    const response = await classifyDocument(
      content,
      fileName,
      templateNames,
      model as any // Type cast for compatibility
    );
    // increment tokenUsage
    const tokens = response.usage.totalTokens;
    console.log("incrementing token usage classify", userId, tokens);
    await incrementAndLogTokenUsage(userId, tokens);
    const documentType = response.object.documentType;
    return NextResponse.json({ documentType });
  } catch (error: any) {
    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to classify document' },
        { status: error.status || 500 }
      );
    }
  }
}
