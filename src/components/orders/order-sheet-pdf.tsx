import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { clientConfig } from "@/lib/client.config"

const ROWS = 18
const INK = "#1a1a1a"
const GRAY = "#6b7280"

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: INK, padding: 36, backgroundColor: "#fff" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: clientConfig.primaryHex },
  sub: { fontSize: 9, color: GRAY, marginTop: 3, marginBottom: 14 },
  fields: { flexDirection: "row", gap: 16, marginBottom: 14 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 8, color: GRAY, marginBottom: 2, letterSpacing: 1 },
  fieldLine: { height: 26, borderBottomWidth: 1.5, borderBottomColor: INK },
  row: { flexDirection: "row", borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1, borderColor: INK, height: 30 },
  head: { borderTopWidth: 1.5, height: 22, backgroundColor: "#f3f4f6" },
  cell: { borderRightWidth: 1, borderColor: INK, justifyContent: "center", paddingHorizontal: 5 },
  sr: { width: 30 },
  code: { width: 120 },
  item: { flex: 1 },
  qty: { width: 80, borderRightWidth: 0 },
  headText: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  srText: { fontSize: 9, color: GRAY },
  tips: { marginTop: 14, fontSize: 8.5, color: GRAY, lineHeight: 1.5 },
})

export function OrderSheetPDFDocument() {
  return (
    <Document title="Order Sheet">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{clientConfig.brandName} — ORDER SHEET</Text>
        <Text style={s.sub}>Write in capital letters, one item per row, inside the boxes.</Text>

        <View style={s.fields}>
          <View style={s.field}><Text style={s.fieldLabel}>CUSTOMER</Text><View style={s.fieldLine} /></View>
          <View style={{ width: 150 }}><Text style={s.fieldLabel}>NEEDED BY (DD / MM / YYYY)</Text><View style={s.fieldLine} /></View>
        </View>

        <View style={[s.row, s.head]}>
          <View style={[s.cell, s.sr]}><Text style={s.headText}>SR</Text></View>
          <View style={[s.cell, s.code]}><Text style={s.headText}>PRODUCT CODE</Text></View>
          <View style={[s.cell, s.item]}><Text style={s.headText}>ITEM</Text></View>
          <View style={[s.cell, s.qty]}><Text style={s.headText}>QTY (PCS)</Text></View>
        </View>
        {Array.from({ length: ROWS }, (_, i) => (
          <View key={i} style={s.row}>
            <View style={[s.cell, s.sr]}><Text style={s.srText}>{i + 1}</Text></View>
            <View style={[s.cell, s.code]} />
            <View style={[s.cell, s.item]} />
            <View style={[s.cell, s.qty]} />
          </View>
        ))}

        <Text style={s.tips}>
          Tips for a clean scan: write the product code whenever you know it. Write numbers plainly (cross your 7s, close your 0s).
          Do not overwrite — strike a line out and use the next row. Photograph the sheet flat, in good light, with all four edges visible.
        </Text>
      </Page>
    </Document>
  )
}
