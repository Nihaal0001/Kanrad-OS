import { NextRequest, NextResponse } from "next/server"
import { zeroAllMaterialStock } from "@/actions/inventory"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-secret") ?? undefined
  const result = await zeroAllMaterialStock(secret)
  return NextResponse.json(result)
}
