export const revalidate = 60

import { getLatestCommodityPrices, getMarketNews } from "@/actions/analytics"
import { getSuppliers } from "@/actions/suppliers"
import { MarketIntelClient } from "./market-intel-client"

export default async function MarketIntelPage() {
  const [commodities, news, suppliers] = await Promise.all([
    getLatestCommodityPrices(),
    getMarketNews(),
    getSuppliers(),
  ])

  return (
    <MarketIntelClient
      commodities={commodities}
      news={news}
      suppliers={suppliers}
    />
  )
}
