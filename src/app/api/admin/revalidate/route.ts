import { NextRequest, NextResponse } from "next/server"
import { revalidateTag, revalidatePath } from "next/cache"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  revalidateTag("materials")
  revalidateTag("categories")
  revalidatePath("/inventory")
  revalidatePath("/master-inventory")
  return NextResponse.json({ success: true })
}
