export const revalidate = 60

import { getLatestCommodityPrices, getMarketNews } from "@/actions/analytics"
import { getCommodityHistory, getBomCostImpact, getTodaysBrief } from "@/actions/market-intel"
import { getSuppliers } from "@/actions/suppliers"
import { createClient } from "@/lib/supabase/server"
import { MarketIntelClient } from "./market-intel-client"

export default async function MarketIntelPage() {
  const [commodities, history, impact, briefData, news, suppliers, isAdmin] = await Promise.all([
    getLatestCommodityPrices(),
    getCommodityHistory(),
    getBomCostImpact(),
    getTodaysBrief(),
    getMarketNews(),
    getSuppliers(),
    (async () => {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_id", user.id)
        .maybeSingle()
      return profile?.role === "admin"
    })(),
  ])

  return (
    <MarketIntelClient
      commodities={commodities}
      history={history}
      impact={impact}
      brief={briefData.brief}
      topStories={briefData.topStories}
      news={news}
      suppliers={suppliers}
      isAdmin={isAdmin}
    />
  )
}
