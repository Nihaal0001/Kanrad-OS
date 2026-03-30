import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import type { OrderDetail } from "@/lib/supabase/types"

const TERRACOTTA = "#c2622a"
const GRAY = "#6b7280"
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
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  companyName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: TERRACOTTA, marginBottom: 3 },
  companyMeta: { fontSize: 9, color: GRAY, lineHeight: 1.5 },
  docTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", letterSpacing: 2, color: DARK, textAlign: "right" },
  docSub: { fontSize: 9, color: GRAY, textAlign: "right", marginTop: 4 },
  divider: { height: 2, backgroundColor: TERRACOTTA, marginBottom: 20 },
  thinDivider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 10 },

  shipRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  shipBox: { flex: 1 },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 5 },
  shipName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  shipText: { fontSize: 9, color: GRAY, lineHeight: 1.5 },

  orderMeta: { flexDirection: "row", gap: 24, marginBottom: 20 },
  metaItem: { minWidth: 100 },
  metaLabel: { fontSize: 8, color: GRAY, marginBottom: 2 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  tableHeader: { flexDirection: "row", backgroundColor: "#f9f5f2", paddingVertical: 7, paddingHorizontal: 10 },
  tableHeaderText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colSl: { width: 28 },
  colSize: { width: 70 },
  colColor: { width: 90 },
  colQty: { width: 60, textAlign: "right" },
  colUnit: { flex: 1 },
  cellText: { fontSize: 10 },
  cellMuted: { fontSize: 10, color: GRAY },

  totalBox: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 10, paddingHorizontal: 10 },
  totalLabel: { fontSize: 10, color: GRAY, marginRight: 24 },
  totalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", width: 60, textAlign: "right" },

  notice: { marginTop: 20, padding: 12, backgroundColor: "#f9f5f2", borderRadius: 4 },
  noticeText: { fontSize: 9, color: GRAY, lineHeight: 1.6, textAlign: "center" },

  checklist: { marginTop: 16, flexDirection: "row", gap: 20 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkBox: { width: 12, height: 12, borderWidth: 1, borderColor: DARK, borderRadius: 2 },
  checkLabel: { fontSize: 9, color: GRAY },

  footer: { position: "absolute", bottom: 30, left: 48, right: 48 },
  footerDivider: { height: 1, backgroundColor: "#e5e7eb", marginBottom: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#9ca3af" },
})

interface Props {
  order: OrderDetail
  org: Record<string, string> | null
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export function PackingSlipPDFDocument({ order, org }: Props) {
  const orgName = org?.org_name || "KANRAD ERP"
  const orgAddress = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(", ")

  const totalQty = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0
  const slipNo = `${order.order_number}-PS`

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{orgName}</Text>
            {orgAddress ? <Text style={s.companyMeta}>{orgAddress}</Text> : null}
            {org?.phone ? <Text style={s.companyMeta}>Phone: {org.phone}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>PACKING</Text>
            <Text style={s.docTitle}>SLIP</Text>
            <Text style={s.docSub}>Slip No: {slipNo}</Text>
            <Text style={s.docSub}>Date: {fmtDate(new Date().toISOString())}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Ship To */}
        <View style={s.shipRow}>
          <View style={s.shipBox}>
            <Text style={s.sectionLabel}>SHIP TO</Text>
            <Text style={s.shipName}>{order.customer?.name ?? "—"}</Text>
            {order.customer?.company ? <Text style={s.shipText}>{order.customer.company}</Text> : null}
            {order.customer?.phone ? <Text style={s.shipText}>Phone: {order.customer.phone}</Text> : null}
            {order.customer?.address ? <Text style={s.shipText}>{order.customer.address}</Text> : null}
          </View>
          <View style={[s.shipBox, { alignItems: "flex-end" }]}>
            <Text style={s.sectionLabel}>ORDER DETAILS</Text>
            <Text style={s.shipText}>Order: {order.order_number}</Text>
            <Text style={s.shipText}>Style: {order.product_variant}</Text>
            <Text style={s.shipText}>Deadline: {fmtDate(order.deadline)}</Text>
            {order.transporter_name ? <Text style={s.shipText}>Via: {order.transporter_name}</Text> : null}
          </View>
        </View>

        <View style={s.thinDivider} />

        {/* Items Table */}
        <View style={s.tableHeader}>
          <View style={s.colSl}><Text style={s.tableHeaderText}>#</Text></View>
          <View style={s.colSize}><Text style={s.tableHeaderText}>SIZE</Text></View>
          <View style={s.colColor}><Text style={s.tableHeaderText}>COLOR</Text></View>
          <View style={s.colUnit}><Text style={s.tableHeaderText}>UNIT</Text></View>
          <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>QTY</Text></View>
        </View>

        {order.order_items?.map((item, idx) => (
          <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
            <View style={s.colSl}><Text style={s.cellMuted}>{idx + 1}</Text></View>
            <View style={s.colSize}><Text style={s.cellText}>{item.size}</Text></View>
            <View style={s.colColor}><Text style={s.cellText}>{item.color}</Text></View>
            <View style={s.colUnit}><Text style={s.cellMuted}>Pcs</Text></View>
            <View style={s.colQty}><Text style={[s.cellText, { textAlign: "right" }]}>{item.quantity}</Text></View>
          </View>
        ))}

        {/* Total */}
        <View style={s.totalBox}>
          <Text style={s.totalLabel}>Total Pieces</Text>
          <Text style={s.totalValue}>{totalQty}</Text>
        </View>

        <View style={s.thinDivider} />

        {/* Checklist */}
        <View style={s.checklist}>
          <View style={s.checkItem}>
            <View style={s.checkBox} />
            <Text style={s.checkLabel}>Quantity verified</Text>
          </View>
          <View style={s.checkItem}>
            <View style={s.checkBox} />
            <Text style={s.checkLabel}>Quality checked</Text>
          </View>
          <View style={s.checkItem}>
            <View style={s.checkBox} />
            <Text style={s.checkLabel}>Labels attached</Text>
          </View>
          <View style={s.checkItem}>
            <View style={s.checkBox} />
            <Text style={s.checkLabel}>Packed &amp; sealed</Text>
          </View>
        </View>

        {/* Notice */}
        <View style={s.notice}>
          <Text style={s.noticeText}>
            Please verify contents against this packing slip before accepting the shipment.
            Any discrepancy must be reported within 24 hours of receipt.
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <View style={s.footerRow}>
            <Text style={s.footerText}>{orgName}</Text>
            <Text style={s.footerText}>Slip No: {slipNo} · {order.order_number}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
