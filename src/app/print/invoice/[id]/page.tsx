import { notFound } from "next/navigation"
import { getInvoice } from "@/actions/finance"
import { getOrgSettings } from "@/app/(dashboard)/settings/actions"
import { AutoPrint } from "./auto-print"

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_LABEL: Record<string, string> = {
  draft: "DRAFT",
  sent: "SENT",
  paid: "PAID",
  partially_paid: "PARTIALLY PAID",
  cancelled: "CANCELLED",
}

const STATUS_COLOR: Record<string, string> = {
  paid: "#16a34a",
  partially_paid: "#d97706",
  cancelled: "#dc2626",
  draft: "#6b7280",
  sent: "#2563eb",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function PrintInvoicePage({ params }: Props) {
  const { id } = await params

  let invoice
  try {
    invoice = await getInvoice(id)
  } catch {
    notFound()
  }

  const org = await getOrgSettings()
  const orgName = org?.org_name || "KANRAD ERP"
  const orgAddress = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(", ")
  const orgPhone = org?.phone || ""
  const orgEmail = org?.email || ""
  const orgGstin = org?.gstin || ""

  const outstanding = invoice.total_amount - invoice.amount_paid
  const statusColor = STATUS_COLOR[invoice.status] || "#6b7280"

  return (
    <>
      <AutoPrint />
      <div style={{
        width: "210mm",
        minHeight: "297mm",
        margin: "0 auto",
        padding: "14mm 16mm",
        background: "#fff",
        position: "relative",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            <div style={{ fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px", color: "#c2622a" }}>
              {orgName}
            </div>
            {orgAddress && (
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", maxWidth: "260px", lineHeight: "1.5" }}>
                {orgAddress}
              </div>
            )}
            {orgPhone && (
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Phone: {orgPhone}</div>
            )}
            {orgEmail && (
              <div style={{ fontSize: "12px", color: "#6b7280" }}>{orgEmail}</div>
            )}
            {orgGstin && (
              <div style={{ fontSize: "12px", color: "#6b7280" }}>GSTIN: {orgGstin}</div>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "32px", fontWeight: "800", letterSpacing: "2px", color: "#1a1a1a" }}>
              INVOICE
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
              {invoice.invoice_number}
            </div>
            <div style={{
              display: "inline-block",
              marginTop: "8px",
              padding: "3px 10px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: "700",
              letterSpacing: "0.5px",
              border: `1.5px solid ${statusColor}`,
              color: statusColor,
            }}>
              {STATUS_LABEL[invoice.status] ?? invoice.status.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "2px", background: "linear-gradient(to right, #c2622a, #e8d5c4)", marginBottom: "28px" }} />

        {/* Bill To + Invoice Details row */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "1px", color: "#9ca3af", marginBottom: "8px" }}>
              BILL TO
            </div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a1a" }}>{invoice.customer_name}</div>
            {invoice.customer_address && (
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", whiteSpace: "pre-line", lineHeight: "1.5", maxWidth: "240px" }}>
                {invoice.customer_address}
              </div>
            )}
            {invoice.customer_gst && (
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>GSTIN: {invoice.customer_gst}</div>
            )}
          </div>

          <div style={{ textAlign: "right", fontSize: "13px" }}>
            <table style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ color: "#9ca3af", paddingRight: "16px", paddingBottom: "6px" }}>Issue Date</td>
                  <td style={{ fontWeight: "600", paddingBottom: "6px" }}>{invoice.issue_date}</td>
                </tr>
                {invoice.due_date && (
                  <tr>
                    <td style={{ color: "#9ca3af", paddingRight: "16px", paddingBottom: "6px" }}>Due Date</td>
                    <td style={{ fontWeight: "600", paddingBottom: "6px", color: outstanding > 0 && invoice.status !== "paid" ? "#dc2626" : undefined }}>
                      {invoice.due_date}
                    </td>
                  </tr>
                )}
                {invoice.order && (
                  <tr>
                    <td style={{ color: "#9ca3af", paddingRight: "16px" }}>Order Ref</td>
                    <td style={{ fontWeight: "600" }}>{invoice.order.order_number}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px" }}>
          <thead>
            <tr style={{ background: "#f9f5f2" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "2px solid #e5e7eb" }}>
                DESCRIPTION
              </th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "2px solid #e5e7eb", width: "70px" }}>
                QTY
              </th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "2px solid #e5e7eb", width: "120px" }}>
                UNIT PRICE
              </th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "2px solid #e5e7eb", width: "120px" }}>
                AMOUNT
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_items.map((item: { id: string; description: string; quantity: number; unit_price: number; amount: number }, idx: number) => (
              <tr key={item.id} style={{ background: idx % 2 === 1 ? "#fafafa" : "#fff" }}>
                <td style={{ padding: "11px 12px", fontSize: "13px", borderBottom: "1px solid #f3f4f6" }}>
                  {item.description}
                </td>
                <td style={{ padding: "11px 12px", fontSize: "13px", textAlign: "center", color: "#6b7280", borderBottom: "1px solid #f3f4f6" }}>
                  {item.quantity}
                </td>
                <td style={{ padding: "11px 12px", fontSize: "13px", textAlign: "right", color: "#6b7280", borderBottom: "1px solid #f3f4f6" }}>
                  ₹{fmt(item.unit_price)}
                </td>
                <td style={{ padding: "11px 12px", fontSize: "13px", textAlign: "right", fontWeight: "600", borderBottom: "1px solid #f3f4f6" }}>
                  ₹{fmt(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
          <div style={{ width: "240px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
              <span style={{ color: "#6b7280" }}>Subtotal</span>
              <span>₹{fmt(invoice.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
              <span style={{ color: "#6b7280" }}>GST ({invoice.tax_rate}%)</span>
              <span>₹{fmt(invoice.tax_amount)}</span>
            </div>
            <div style={{ height: "1px", background: "#e5e7eb", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#c2622a", borderRadius: "6px", fontSize: "15px", fontWeight: "800", color: "#fff" }}>
              <span>TOTAL</span>
              <span>₹{fmt(invoice.total_amount)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", marginTop: "8px", color: "#16a34a" }}>
                  <span>Amount Paid</span>
                  <span>₹{fmt(invoice.amount_paid)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", fontWeight: "700", color: outstanding > 0 ? "#dc2626" : "#16a34a" }}>
                  <span>Outstanding</span>
                  <span>₹{fmt(outstanding)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ background: "#f9f5f2", borderRadius: "8px", padding: "14px 16px", marginBottom: "32px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "1px", color: "#9ca3af", marginBottom: "6px" }}>
              NOTES / TERMS
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: "1.6", whiteSpace: "pre-line" }}>
              {invoice.notes}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ position: "absolute", bottom: "14mm", left: "16mm", right: "16mm" }}>
          <div style={{ height: "1px", background: "#e5e7eb", marginBottom: "10px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9ca3af" }}>
            <span>{orgName}{orgGstin ? ` · GSTIN: ${orgGstin}` : ""}</span>
            <span>Thank you for your business</span>
          </div>
        </div>
      </div>
    </>
  )
}
