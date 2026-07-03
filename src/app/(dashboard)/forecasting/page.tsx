export const revalidate = 60

import { getDemandForecast, getInventoryForecast, getSalesForecast, getLatestCommodityPrices } from "@/actions/analytics"
import { ForecastingClient } from "./forecasting-client"

export default async function ForecastingPage() {
  const [demand, inventory, sales, commodities] = await Promise.all([
    getDemandForecast(),
    getInventoryForecast(),
    getSalesForecast(),
    getLatestCommodityPrices(),
  ])

  const forecastCommodities = commodities
    .filter((c) => c.latest_price)
    .map((c) => ({ id: c.id, name: c.name }))

  return (
    <ForecastingClient
      demand={demand}
      inventory={inventory}
      sales={sales}
      forecastCommodities={forecastCommodities}
    />
  )
}
