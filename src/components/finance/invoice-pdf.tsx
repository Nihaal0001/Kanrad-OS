import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import type { InvoiceDetail } from "@/lib/supabase/types"

const TERRACOTTA = "#c2622a"
const GRAY = "#6b7280"
const LIGHT_GRAY = "#f3f4f6"
const DARK = "#1a1a1a"

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 48,
    backgroundColor: "#ffffff",
  },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  companyName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: TERRACOTTA, marginBottom: 3 },
  companyMeta: { fontSize: 9, color: GRAY, lineHeight: 1.5 },
  invoiceTitle: { fontSize: 28, fontFamily: "Helvetica-Bold", letterSpacing: 2, color: DARK, textAlign: "right" },
  invoiceNumber: { fontSize: 10, color: GRAY, textAlign: "right", marginTop: 3 },
  statusBadge: { marginTop: 8, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 4, alignSelf: "flex-end" },
  statusText: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },

  // Divider
  divider: { height: 2, backgroundColor: TERRACOTTA, marginBottom: 24 },
  thinDivider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 8 },

  // Bill To + Meta row
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 5 },
  buyerName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  buyerMeta: { fontSize: 9, color: GRAY, lineHeight: 1.5 },
  metaTable: { alignItems: "flex-end" },
  metaRow2: { flexDirection: "row", marginBottom: 5 },
  metaLabel: { fontSize: 9, color: GRAY, marginRight: 12, width: 60, textAlign: "right" },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" },

  // Items Table
  tableHeader: { flexDirection: "row", backgroundColor: "#f9f5f2", paddingVertical: 8, paddingHorizontal: 10, marginBottom: 0 },
  tableHeaderText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: "center" },
  colPrice: { width: 80, textAlign: "right" },
  colAmount: { width: 80, textAlign: "right" },
  cellText: { fontSize: 10 },
  cellMuted: { fontSize: 10, color: GRAY },
  cellBold: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  // Totals
  totalsContainer: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 28 },
  totalsBox: { width: 200 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: GRAY },
  totalValue: { fontSize: 10 },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: TERRACOTTA, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 5, marginTop: 4 },
  grandTotalText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  paidRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  paidLabel: { fontSize: 10, color: "#16a34a" },
  paidValue: { fontSize: 10, color: "#16a34a" },

  // Notes
  notesBox: { backgroundColor: "#f9f5f2", borderRadius: 6, padding: 12, marginBottom: 28 },
  notesLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 5 },
  notesText: { fontSize: 9, color: GRAY, lineHeight: 1.6 },

  // Footer
  footer: { position: "absolute", bottom: 30, left: 48, right: 48 },
  footerDivider: { height: 1, backgroundColor: "#e5e7eb", marginBottom: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#9ca3af" },
})

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
  draft: "#9ca3af",
  sent: "#2563eb",
}

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  invoice: InvoiceDetail
  org: Record<string, string> | null
}

export function InvoicePDFDocument({ invoice, org }: Props) {
  const orgName = org?.org_name || "JUST CLOTHING"
  const orgAddress = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(", ")
  const orgPhone = org?.phone || ""
  const orgEmail = org?.email || ""
  const orgGstin = org?.gstin || ""

  const outstanding = invoice.total_amount - invoice.amount_paid
  const statusColor = STATUS_COLOR[invoice.status] ?? "#9ca3af"
  const statusLabel = STATUS_LABEL[invoice.status] ?? invoice.status.toUpperCase()

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{orgName}</Text>
            {orgAddress ? <Text style={s.companyMeta}>{orgAddress}</Text> : null}
            {orgPhone ? <Text style={s.companyMeta}>Phone: {orgPhone}</Text> : null}
            {orgEmail ? <Text style={s.companyMeta}>{orgEmail}</Text> : null}
            {orgGstin ? <Text style={s.companyMeta}>GSTIN: {orgGstin}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNumber}>{invoice.invoice_number}</Text>
            <View style={[s.statusBadge, { borderWidth: 1.5, borderColor: statusColor }]}>
              <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Bill To + Invoice Meta */}
        <View style={s.metaRow}>
          <View>
            <Text style={s.sectionLabel}>BILL TO</Text>
            <Text style={s.buyerName}>{invoice.buyer_name}</Text>
            {invoice.buyer_address ? <Text style={s.buyerMeta}>{invoice.buyer_address}</Text> : null}
            {invoice.buyer_gst ? <Text style={s.buyerMeta}>GSTIN: {invoice.buyer_gst}</Text> : null}
          </View>
          <View style={s.metaTable}>
            <View style={s.metaRow2}>
              <Text style={s.metaLabel}>Issue Date</Text>
              <Text style={s.metaValue}>{invoice.issue_date}</Text>
            </View>
            {invoice.due_date ? (
              <View style={s.metaRow2}>
                <Text style={s.metaLabel}>Due Date</Text>
                <Text style={[s.metaValue, outstanding > 0 && invoice.status !== "paid" ? { color: "#dc2626" } : {}]}>
                  {invoice.due_date}
                </Text>
              </View>
            ) : null}
            {invoice.order ? (
              <View style={s.metaRow2}>
                <Text style={s.metaLabel}>Order Ref</Text>
                <Text style={s.metaValue}>{invoice.order.order_number}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Items Table */}
        <View style={{ marginBottom: 20 }}>
          {/* Table Header */}
          <View style={s.tableHeader}>
            <View style={s.colDesc}><Text style={s.tableHeaderText}>DESCRIPTION</Text></View>
            <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>QTY</Text></View>
            <View style={s.colPrice}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>UNIT PRICE</Text></View>
            <View style={s.colAmount}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>AMOUNT</Text></View>
          </View>

          {/* Rows */}
          {invoice.invoice_items.map((item, idx) => (
            <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
              <View style={s.colDesc}><Text style={s.cellText}>{item.description}</Text></View>
              <View style={s.colQty}><Text style={[s.cellMuted, { textAlign: "center" }]}>{item.quantity}</Text></View>
              <View style={s.colPrice}><Text style={[s.cellMuted, { textAlign: "right" }]}>{fmt(item.unit_price)}</Text></View>
              <View style={s.colAmount}><Text style={[s.cellBold, { textAlign: "right" }]}>{fmt(item.amount)}</Text></View>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalsContainer}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{fmt(invoice.subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>GST ({invoice.tax_rate}%)</Text>
              <Text style={s.totalValue}>{fmt(invoice.tax_amount)}</Text>
            </View>
            <View style={s.thinDivider} />
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalText}>TOTAL</Text>
              <Text style={s.grandTotalText}>{fmt(invoice.total_amount)}</Text>
            </View>
            {invoice.amount_paid > 0 && (
              <>
                <View style={s.paidRow}>
                  <Text style={s.paidLabel}>Amount Paid</Text>
                  <Text style={s.paidValue}>{fmt(invoice.amount_paid)}</Text>
                </View>
                <View style={s.paidRow}>
                  <Text style={[s.totalLabel, { fontFamily: "Helvetica-Bold", color: outstanding > 0 ? "#dc2626" : "#16a34a" }]}>
                    Outstanding
                  </Text>
                  <Text style={[s.totalValue, { fontFamily: "Helvetica-Bold", color: outstanding > 0 ? "#dc2626" : "#16a34a" }]}>
                    {fmt(outstanding)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>NOTES / TERMS</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <View style={s.footerRow}>
            <Text style={s.footerText}>{orgName}{orgGstin ? ` · GSTIN: ${orgGstin}` : ""}</Text>
            <Text style={s.footerText}>Thank you for your business</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
