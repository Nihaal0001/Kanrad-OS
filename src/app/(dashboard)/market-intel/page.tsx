import { getLatestMaterialPrices, getMarketNews } from "@/actions/analytics"
import { getSuppliers } from "@/actions/suppliers"
import { MarketIntelClient } from "./market-intel-client"

export default async function MarketIntelPage() {
  const [materials, news, suppliers] = await Promise.all([
    getLatestMaterialPrices(),
    getMarketNews(),
    getSuppliers(),
  ])

  return (
    <MarketIntelClient
      materials={materials}
      news={news}
      suppliers={suppliers}
    />
  )
}
