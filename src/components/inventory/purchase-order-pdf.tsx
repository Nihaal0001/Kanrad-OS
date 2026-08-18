import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import { amountInWords } from "@/lib/number-to-words"

const BLACK = "#000000"

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: BLACK,
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 48,
    backgroundColor: "#ffffff",
  },

  title: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 1, textAlign: "center", marginBottom: 10 },

  // Header grid
  headerBox: { flexDirection: "row", borderWidth: 1, borderColor: BLACK, marginBottom: 0 },
  leftCol: { width: 300, borderRightWidth: 1, borderColor: BLACK },
  rightCol: { flex: 1 },

  partySection: { padding: 6, borderBottomWidth: 1, borderColor: BLACK },
  partySectionLast: { padding: 6 },
  partyLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  partyName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  partyLine: { fontSize: 8.5, lineHeight: 1.4 },

  fieldRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: BLACK },
  fieldCellHalf: { width: "50%", padding: 6, borderRightWidth: 1, borderColor: BLACK },
  fieldCellFull: { padding: 6, flex: 1 },
  fieldCellTall: { padding: 6, flex: 1, minHeight: 44 },
  fieldLabel: { fontSize: 8, color: "#333333", marginBottom: 2 },
  fieldValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // Items table
  table: { borderWidth: 1, borderColor: BLACK, borderTopWidth: 0 },
  tRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BLACK },
  tRowHeader: { flexDirection: "row" },
  colSi: { width: 30, padding: 4, borderRightWidth: 1, borderColor: BLACK },
  colDesc: { flex: 1, padding: 4, borderRightWidth: 1, borderColor: BLACK },
  colPart: { width: 66, padding: 4, borderRightWidth: 1, borderColor: BLACK },
  colQty: { width: 82, padding: 4, borderRightWidth: 1, borderColor: BLACK, textAlign: "right" },
  colRate: { width: 54, padding: 4, borderRightWidth: 1, borderColor: BLACK, textAlign: "right" },
  colPer: { width: 34, padding: 4, borderRightWidth: 1, borderColor: BLACK, textAlign: "center" },
  colAmount: { width: 80, padding: 4, textAlign: "right" },
  thText: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  tdText: { fontSize: 8.5 },
  tdBold: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // Amount in words
  wordsBox: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderTopWidth: 0, borderColor: BLACK, padding: 6 },
  wordsText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", flex: 1, paddingRight: 8 },
  eoeText: { fontSize: 8, alignSelf: "flex-end" },

  // Signature block
  signBox: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: BLACK, minHeight: 70 },
  signLeft: { width: 300, padding: 6, borderRightWidth: 1, borderColor: BLACK },
  signRight: { flex: 1, padding: 6, justifyContent: "space-between" },
  panText: { fontSize: 8.5 },
  forText: { fontSize: 8.5, textAlign: "right" },
  signatoryText: { fontSize: 8.5, textAlign: "right" },

  footerNote: { fontSize: 7.5, fontStyle: "italic", textAlign: "center", marginTop: 10, color: "#333333" },
})

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(d: string | null) {
  if (!d) return ""
  const date = new Date(d + "T00:00:00")
  if (isNaN(date.getTime())) return d
  const day = String(date.getDate()).padStart(2, "0")
  const month = date.toLocaleString("en-US", { month: "short" })
  const year = String(date.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

function stateCode(gstin: string | null | undefined) {
  return gstin && gstin.length >= 2 ? gstin.slice(0, 2) : ""
}

function panFromGstin(gstin: string | null | undefined) {
  return gstin && gstin.length >= 12 ? gstin.slice(2, 12) : ""
}

export interface PurchaseOrderPDFData {
  po_number: string
  status: string
  order_date: string
  expected_date: string | null
  tax_rate: number
  reference_no: string | null
  other_references: string | null
  dispatched_through: string | null
  destination: string | null
  terms_of_delivery: string | null
  mode_of_payment: string | null
  supplier_name: string
  supplier_contact: string | null
  supplier: {
    name: string
    company: string | null
    address: string | null
    city: string | null
    state: string | null
    gstin: string | null
    phone: string | null
  } | null
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

function PartyBlock({
  label,
  name,
  address,
  gstin,
  state,
  last,
}: {
  label: string
  name: string
  address: string
  gstin: string
  state: string
  last?: boolean
}) {
  const code = stateCode(gstin)
  return (
    <View style={last ? s.partySectionLast : s.partySection}>
      <Text style={s.partyLabel}>{label}</Text>
      <Text style={s.partyName}>{name}</Text>
      {address ? <Text style={s.partyLine}>{address}</Text> : null}
      {gstin ? <Text style={s.partyLine}>GSTIN/UIN: {gstin}</Text> : null}
      {state ? <Text style={s.partyLine}>State Name : {state}{code ? `, Code : ${code}` : ""}</Text> : null}
    </View>
  )
}

export function PurchaseOrderPDFDocument({ po, org }: Props) {
  const orgName = org?.org_name || "KANRAD ERP"
  const orgAddress = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(", ")
  const orgGstin = org?.gstin || ""
  const orgState = org?.state || ""
  const pan = panFromGstin(orgGstin)

  const supplierName = po.supplier?.name || po.supplier_name
  const supplierAddress = po.supplier
    ? [po.supplier.address, po.supplier.city].filter(Boolean).join(", ")
    : ""
  const supplierGstin = po.supplier?.gstin || ""
  const supplierState = po.supplier?.state || ""

  const isIgst = (() => {
    const orgCode = stateCode(orgGstin)
    const supCode = stateCode(supplierGstin)
    if (!orgCode || !supCode) return false
    return orgCode !== supCode
  })()

  const subtotal = po.items.reduce((sum, item) => sum + item.quantity_ordered * item.unit_price, 0)
  const taxAmount = subtotal * (po.tax_rate / 100)
  const grandTotal = subtotal + taxAmount
  const halfRate = po.tax_rate / 2
  const halfTax = taxAmount / 2

  const totalQty = po.items.reduce((sum, item) => sum + item.quantity_ordered, 0)
  const firstUnit = po.items[0]?.material?.unit ?? ""

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>PURCHASE ORDER</Text>

        <View style={s.headerBox}>
          <View style={s.leftCol}>
            <PartyBlock
              label="Invoice To"
              name={orgName}
              address={orgAddress}
              gstin={orgGstin}
              state={orgState}
            />
            <PartyBlock
              label="Consignee (Ship to)"
              name={orgName}
              address={orgAddress}
              gstin={orgGstin}
              state={orgState}
            />
            <PartyBlock
              label="Supplier (Bill from)"
              name={supplierName}
              address={supplierAddress}
              gstin={supplierGstin}
              state={supplierState}
              last
            />
          </View>

          <View style={s.rightCol}>
            <View style={s.fieldRow}>
              <View style={s.fieldCellHalf}>
                <Text style={s.fieldLabel}>Voucher No.</Text>
                <Text style={s.fieldValue}>{po.po_number}</Text>
              </View>
              <View style={s.fieldCellFull}>
                <Text style={s.fieldLabel}>Dated</Text>
                <Text style={s.fieldValue}>{fmtDate(po.order_date)}</Text>
              </View>
            </View>
            <View style={s.fieldRow}>
              <View style={s.fieldCellFull}>
                <Text style={s.fieldLabel}>Mode/Terms of Payment</Text>
                <Text style={s.fieldValue}>{po.mode_of_payment || ""}</Text>
              </View>
            </View>
            <View style={s.fieldRow}>
              <View style={s.fieldCellHalf}>
                <Text style={s.fieldLabel}>Reference No. &amp; Date.</Text>
                <Text style={s.fieldValue}>{po.reference_no || po.po_number}</Text>
              </View>
              <View style={s.fieldCellFull}>
                <Text style={s.fieldLabel}>Other References</Text>
                <Text style={s.fieldValue}>{po.other_references || ""}</Text>
              </View>
            </View>
            <View style={s.fieldRow}>
              <View style={s.fieldCellHalf}>
                <Text style={s.fieldLabel}>Dispatched through</Text>
                <Text style={s.fieldValue}>{po.dispatched_through || ""}</Text>
              </View>
              <View style={s.fieldCellFull}>
                <Text style={s.fieldLabel}>Destination</Text>
                <Text style={s.fieldValue}>{po.destination || ""}</Text>
              </View>
            </View>
            <View style={[s.fieldRow, { borderBottomWidth: 0 }]}>
              <View style={s.fieldCellTall}>
                <Text style={s.fieldLabel}>Terms of Delivery</Text>
                <Text style={s.fieldValue}>{po.terms_of_delivery || ""}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={s.table}>
          <View style={s.tRowHeader}>
            <View style={s.colSi}><Text style={s.thText}>SI No.</Text></View>
            <View style={s.colDesc}><Text style={s.thText}>Description of Goods</Text></View>
            <View style={s.colPart}><Text style={s.thText}>Part No.</Text></View>
            <View style={s.colQty}><Text style={s.thText}>Quantity</Text></View>
            <View style={s.colRate}><Text style={s.thText}>Rate</Text></View>
            <View style={s.colPer}><Text style={s.thText}>per</Text></View>
            <View style={s.colAmount}><Text style={s.thText}>Amount</Text></View>
          </View>

          {po.items.map((item, idx) => (
            <View key={idx} style={s.tRow}>
              <View style={s.colSi}><Text style={s.tdText}>{idx + 1}</Text></View>
              <View style={s.colDesc}><Text style={s.tdText}>{item.material?.name ?? "—"}</Text></View>
              <View style={s.colPart}><Text style={s.tdText}>{item.material?.sku ?? ""}</Text></View>
              <View style={s.colQty}><Text style={s.tdText}>{fmt(item.quantity_ordered, 3)} {item.material?.unit ?? ""}</Text></View>
              <View style={s.colRate}><Text style={s.tdText}>{fmt(item.unit_price)}</Text></View>
              <View style={s.colPer}><Text style={s.tdText}>{item.material?.unit ?? ""}</Text></View>
              <View style={s.colAmount}><Text style={s.tdText}>{fmt(item.quantity_ordered * item.unit_price)}</Text></View>
            </View>
          ))}

          {po.tax_rate > 0 && (
            isIgst ? (
              <View style={s.tRow}>
                <View style={s.colSi}><Text style={s.tdText}></Text></View>
                <View style={s.colDesc}><Text style={s.tdText}>IGST Input @ {po.tax_rate}%</Text></View>
                <View style={s.colPart}><Text style={s.tdText}></Text></View>
                <View style={s.colQty}><Text style={s.tdText}></Text></View>
                <View style={s.colRate}><Text style={s.tdText}>{po.tax_rate}</Text></View>
                <View style={s.colPer}><Text style={s.tdText}>%</Text></View>
                <View style={s.colAmount}><Text style={s.tdText}>{fmt(taxAmount)}</Text></View>
              </View>
            ) : (
              <>
                <View style={s.tRow}>
                  <View style={s.colSi}><Text style={s.tdText}></Text></View>
                  <View style={s.colDesc}><Text style={s.tdText}>CGST Input @ {halfRate}%</Text></View>
                  <View style={s.colPart}><Text style={s.tdText}></Text></View>
                  <View style={s.colQty}><Text style={s.tdText}></Text></View>
                  <View style={s.colRate}><Text style={s.tdText}>{halfRate}</Text></View>
                  <View style={s.colPer}><Text style={s.tdText}>%</Text></View>
                  <View style={s.colAmount}><Text style={s.tdText}>{fmt(halfTax)}</Text></View>
                </View>
                <View style={s.tRow}>
                  <View style={s.colSi}><Text style={s.tdText}></Text></View>
                  <View style={s.colDesc}><Text style={s.tdText}>SGST Input @ {halfRate}%</Text></View>
                  <View style={s.colPart}><Text style={s.tdText}></Text></View>
                  <View style={s.colQty}><Text style={s.tdText}></Text></View>
                  <View style={s.colRate}><Text style={s.tdText}>{halfRate}</Text></View>
                  <View style={s.colPer}><Text style={s.tdText}>%</Text></View>
                  <View style={s.colAmount}><Text style={s.tdText}>{fmt(halfTax)}</Text></View>
                </View>
              </>
            )
          )}

          <View style={[s.tRow, { borderTopWidth: 1.5 }]}>
            <View style={s.colSi}><Text style={s.tdText}></Text></View>
            <View style={s.colDesc}><Text style={[s.tdBold, { textAlign: "right" }]}>Total</Text></View>
            <View style={s.colPart}><Text style={s.tdText}></Text></View>
            <View style={s.colQty}><Text style={s.tdBold}>{fmt(totalQty, 3)} {firstUnit}</Text></View>
            <View style={s.colRate}><Text style={s.tdText}></Text></View>
            <View style={s.colPer}><Text style={s.tdText}></Text></View>
            <View style={s.colAmount}><Text style={s.tdBold}>Rs. {fmt(grandTotal)}</Text></View>
          </View>
        </View>

        {/* Amount in words */}
        <View style={s.wordsBox}>
          <Text style={s.wordsText}>Amount Chargeable (in words){"\n"}{amountInWords(grandTotal)}</Text>
          <Text style={s.eoeText}>E. &amp; O.E</Text>
        </View>

        {/* Signature block */}
        <View style={s.signBox}>
          <View style={s.signLeft}>
            <Text style={s.panText}>Company&apos;s PAN : {pan}</Text>
          </View>
          <View style={s.signRight}>
            <Text style={s.forText}>for {orgName}</Text>
            <Text style={s.signatoryText}>Authorised Signatory</Text>
          </View>
        </View>

        <Text style={s.footerNote}>This is a Computer Generated Document</Text>
      </Page>
    </Document>
  )
}
