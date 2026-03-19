import { redirect } from "next/navigation"

export default async function CustomersRedirectPage() {
  redirect("/customers")
}
