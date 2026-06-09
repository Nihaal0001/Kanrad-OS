import { NextResponse } from "next/server"
import { zeroAllMaterialStock } from "@/actions/inventory"

export async function POST() {
  const result = await zeroAllMaterialStock()
  return NextResponse.json(result)
}
