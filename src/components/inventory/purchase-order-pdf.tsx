import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

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
  companyName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: TERRACOTTA, marginBottom: 3 },
  companyMeta: { fontSize: 9, color: GRAY, lineHeight: 1.5 },
  docTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", letterSpacing: 2, color: DARK, textAlign: "right" },
  docNumber: { fontSize: 10, color: GRAY, textAlign: "right", marginTop: 3 },
  statusBadge: { marginTop: 8, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 4, alignSelf: "flex-end" },
  statusText: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },

  divider: { height: 2, backgroundColor: TERRACOTTA, marginBottom: 24 },
  thinDivider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 8 },

  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 5 },
  partyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  partyMeta: { fontSize: 9, color: GRAY, lineHeight: 1.5 },
  metaTable: { alignItems: "flex-end" },
  metaRow2: { flexDirection: "row", marginBottom: 5 },
  metaLabel: { fontSize: 9, color: GRAY, marginRight: 12, width: 90, textAlign: "right" },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" },

  tableHeader: { flexDirection: "row", backgroundColor: "#f9f5f2", paddingVertical: 8, paddingHorizontal: 10 },
  tableHeaderText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colSku: { width: 76 },
  colDesc: { flex: 1 },
  colQty: { width: 60, textAlign: "center" },
  colPrice: { width: 76, textAlign: "right" },
  colAmount: { width: 84, textAlign: "right" },
  cellText: { fontSize: 10 },
  cellMuted: { fontSize: 10, color: GRAY },
  cellBold: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  totalsContainer: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 28 },
  totalsBox: { width: 210 },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: TERRACOTTA, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 5, marginTop: 4 },
  grandTotalText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  notesBox: { backgroundColor: "#f9f5f2", borderRadius: 6, padding: 12, marginBottom: 28 },
  notesLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 5 },
  notesText: { fontSize: 9, color: GRAY, lineHeight: 1.6 },

  footer: { position: "absolute", bottom: 30, left: 48, right: 48 },
  footerDivider: { height: 1, backgroundColor: "#e5e7eb", marginBottom: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#9ca3af" },
})

const STATUS_LABEL: Record<string, string> = {
  draft: "DRAFT",
  sent: "SENT",
  partial: "PARTIALLY RECEIVED",
  received: "RECEIVED",
  cancelled: "CANCELLED",
}

const STATUS_COLOR: Record<string, string> = {
  draft: "#9ca3af",
  sent: "#2563eb",
  partial: "#d97706",
  received: "#16a34a",
  cancelled: "#dc2626",
}

function fmt(n: number) {
  return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface PurchaseOrderPDFData {
  po_number: string
  status: string
  order_date: string
  expected_date: string | null
  supplier_name: string
  supplier_contact: string | null
  total_amount: number
  notes: string | null
  items: Array<{
    material: { name: string; sku: string; unit: string } | null
    quantity_ordered: number
    unit_price: number
  }>
}

interface Props {
  po: PurchaseOrderPDFData
  org: Record<string, string> | null
}

export function PurchaseOrderPDFDocument({ po, org }: Props) {
  const orgName = org?.org_name || "KANRAD ERP"
  const orgAddress = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(", ")
  const orgPhone = org?.phone || ""
  const orgEmail = org?.email || ""
  const orgGstin = org?.gstin || ""

  const statusColor = STATUS_COLOR[po.status] ?? "#9ca3af"
  const statusLabel = STATUS_LABEL[po.status] ?? po.status.toUpperCase()

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{orgName}</Text>
            {orgAddress ? <Text style={s.companyMeta}>{orgAddress}</Text> : null}
            {orgPhone ? <Text style={s.companyMeta}>Phone: {orgPhone}</Text> : null}
            {orgEmail ? <Text style={s.companyMeta}>{orgEmail}</Text> : null}
            {orgGstin ? <Text style={s.companyMeta}>GSTIN: {orgGstin}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.docTitle}>PURCHASE ORDER</Text>
            <Text style={s.docNumber}>{po.po_number}</Text>
            <View style={[s.statusBadge, { borderWidth: 1.5, borderColor: statusColor }]}>
              <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.metaRow}>
          <View>
            <Text style={s.sectionLabel}>VENDOR</Text>
            <Text style={s.partyName}>{po.supplier_name}</Text>
            {po.supplier_contact ? <Text style={s.partyMeta}>{po.supplier_contact}</Text> : null}
          </View>
          <View style={s.metaTable}>
            <View style={s.metaRow2}>
              <Text style={s.metaLabel}>Order Date</Text>
              <Text style={s.metaValue}>{po.order_date}</Text>
            </View>
            {po.expected_date ? (
              <View style={s.metaRow2}>
                <Text style={s.metaLabel}>Due On</Text>
                <Text style={s.metaValue}>{po.expected_date}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <View style={s.tableHeader}>
            <View style={s.colSku}><Text style={s.tableHeaderText}>SKU</Text></View>
            <View style={s.colDesc}><Text style={s.tableHeaderText}>ITEM</Text></View>
            <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>QTY</Text></View>
            <View style={s.colPrice}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>RATE</Text></View>
            <View style={s.colAmount}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>AMOUNT</Text></View>
          </View>

          {po.items.map((item, idx) => {
            const amount = item.quantity_ordered * item.unit_price
            return (
              <View key={idx} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
                <View style={s.colSku}><Text style={s.cellMuted}>{item.material?.sku ?? ""}</Text></View>
                <View style={s.colDesc}><Text style={s.cellText}>{item.material?.name ?? "—"}</Text></View>
                <View style={s.colQty}><Text style={[s.cellMuted, { textAlign: "center" }]}>{item.quantity_ordered} {item.material?.unit ?? ""}</Text></View>
                <View style={s.colPrice}><Text style={[s.cellMuted, { textAlign: "right" }]}>{fmt(item.unit_price)}</Text></View>
                <View style={s.colAmount}><Text style={[s.cellBold, { textAlign: "right" }]}>{fmt(amount)}</Text></View>
              </View>
            )
          })}
        </View>

        <View style={s.totalsContainer}>
          <View style={s.totalsBox}>
            <View style={s.thinDivider} />
            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalText}>TOTAL</Text>
              <Text style={s.grandTotalText}>{fmt(po.total_amount)}</Text>
            </View>
          </View>
        </View>

        {po.notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>NOTES</Text>
            <Text style={s.notesText}>{po.notes}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <View style={s.footerRow}>
            <Text style={s.footerText}>{orgName}{orgGstin ? ` · GSTIN: ${orgGstin}` : ""}</Text>
            <Text style={s.footerText}>Please confirm receipt of this order</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
