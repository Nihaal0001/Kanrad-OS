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

  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  infoBox: { flex: 1 },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 5 },
  infoName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  infoText: { fontSize: 9, color: GRAY, lineHeight: 1.5 },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20, gap: 16 },
  metaItem: { minWidth: 120 },
  metaLabel: { fontSize: 8, color: GRAY, marginBottom: 2 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  tableHeader: { flexDirection: "row", backgroundColor: "#f9f5f2", paddingVertical: 7, paddingHorizontal: 10 },
  tableHeaderText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colSl: { width: 28 },
  colDesc: { flex: 1 },
  colSize: { width: 50 },
  colColor: { width: 60 },
  colQty: { width: 50, textAlign: "right" },
  cellText: { fontSize: 10 },
  cellMuted: { fontSize: 10, color: GRAY },

  totalRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 6, paddingHorizontal: 10 },
  totalLabel: { fontSize: 10, color: GRAY, marginRight: 24 },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", width: 50, textAlign: "right" },

  declaration: { marginTop: 24, padding: 12, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4 },
  declarationTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 5 },
  declarationText: { fontSize: 9, color: GRAY, lineHeight: 1.6 },

  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  signatureBox: { width: 160, borderTopWidth: 1, borderTopColor: DARK, paddingTop: 6 },
  signatureLabel: { fontSize: 8, color: GRAY },

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

export function ChallanPDFDocument({ order, org }: Props) {
  const orgName = org?.org_name || "JUST CLOTHING"
  const orgAddress = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(", ")
  const orgGstin = org?.gstin || ""

  const totalQty = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0
  const challanNo = `${order.order_number}-DC`

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{orgName}</Text>
            {orgAddress ? <Text style={s.companyMeta}>{orgAddress}</Text> : null}
            {org?.phone ? <Text style={s.companyMeta}>Phone: {org.phone}</Text> : null}
            {orgGstin ? <Text style={s.companyMeta}>GSTIN: {orgGstin}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>DELIVERY</Text>
            <Text style={s.docTitle}>CHALLAN</Text>
            <Text style={s.docSub}>No: {challanNo}</Text>
            <Text style={s.docSub}>Date: {fmtDate(order.dispatch_date ?? new Date().toISOString())}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Consignee + Transport Info */}
        <View style={s.infoRow}>
          <View style={s.infoBox}>
            <Text style={s.sectionLabel}>CONSIGNEE</Text>
            <Text style={s.infoName}>{order.customer?.name ?? "—"}</Text>
            {order.customer?.company ? <Text style={s.infoText}>{order.customer.company}</Text> : null}
            {order.customer?.phone ? <Text style={s.infoText}>Phone: {order.customer.phone}</Text> : null}
            {order.customer?.email ? <Text style={s.infoText}>{order.customer.email}</Text> : null}
            {order.customer?.gstin ? <Text style={s.infoText}>GSTIN: {order.customer.gstin}</Text> : null}
          </View>
          <View style={[s.infoBox, { alignItems: "flex-end" }]}>
            <Text style={s.sectionLabel}>TRANSPORT DETAILS</Text>
            {order.transporter_name ? <Text style={s.infoText}>Transporter: {order.transporter_name}</Text> : null}
            {order.lr_number ? <Text style={s.infoText}>LR No: {order.lr_number}</Text> : null}
            {order.vehicle_number ? <Text style={s.infoText}>Vehicle: {order.vehicle_number}</Text> : null}
            {order.expected_delivery_date ? <Text style={s.infoText}>Expected Delivery: {fmtDate(order.expected_delivery_date)}</Text> : null}
          </View>
        </View>

        {/* Order Meta */}
        <View style={s.metaGrid}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Order Number</Text>
            <Text style={s.metaValue}>{order.order_number}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Style</Text>
            <Text style={s.metaValue}>{order.style_name}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Deadline</Text>
            <Text style={s.metaValue}>{fmtDate(order.deadline)}</Text>
          </View>
        </View>

        <View style={s.thinDivider} />

        {/* Items Table */}
        <View style={s.tableHeader}>
          <View style={s.colSl}><Text style={s.tableHeaderText}>#</Text></View>
          <View style={s.colDesc}><Text style={s.tableHeaderText}>DESCRIPTION</Text></View>
          <View style={s.colSize}><Text style={s.tableHeaderText}>SIZE</Text></View>
          <View style={s.colColor}><Text style={s.tableHeaderText}>COLOR</Text></View>
          <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>QTY</Text></View>
        </View>

        {order.order_items?.map((item, idx) => (
          <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
            <View style={s.colSl}><Text style={s.cellMuted}>{idx + 1}</Text></View>
            <View style={s.colDesc}><Text style={s.cellText}>{order.style_name}</Text></View>
            <View style={s.colSize}><Text style={s.cellText}>{item.size}</Text></View>
            <View style={s.colColor}><Text style={s.cellText}>{item.color}</Text></View>
            <View style={s.colQty}><Text style={[s.cellText, { textAlign: "right" }]}>{item.quantity}</Text></View>
          </View>
        ))}

        {/* Total */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Quantity</Text>
          <Text style={s.totalValue}>{totalQty}</Text>
        </View>

        <View style={s.thinDivider} />

        {/* Declaration */}
        <View style={s.declaration}>
          <Text style={s.declarationTitle}>DECLARATION</Text>
          <Text style={s.declarationText}>
            We declare that this challan shows the actual quantity of goods described above and that the particulars given are true and correct.
            This is not a tax invoice. Goods are being dispatched for delivery/job work purposes.
          </Text>
        </View>

        {/* Signature Row */}
        <View style={s.signatureRow}>
          <View style={s.signatureBox}>
            <Text style={s.signatureLabel}>Receiver&apos;s Signature &amp; Stamp</Text>
          </View>
          <View style={s.signatureBox}>
            <Text style={s.signatureLabel}>For {orgName}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <View style={s.footerRow}>
            <Text style={s.footerText}>{orgName}{orgGstin ? ` · GSTIN: ${orgGstin}` : ""}</Text>
            <Text style={s.footerText}>Challan No: {challanNo}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
