import { getDemandForecast, getInventoryForecast } from "@/actions/analytics"
import { ForecastingClient } from "./forecasting-client"

export default async function ForecastingPage() {
  const [demand, inventory] = await Promise.all([
    getDemandForecast(),
    getInventoryForecast(),
  ])

  return <ForecastingClient demand={demand} inventory={inventory} />
}
