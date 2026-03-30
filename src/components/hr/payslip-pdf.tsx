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
  companyName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: TERRACOTTA, marginBottom: 3 },
  companyMeta: { fontSize: 9, color: GRAY, lineHeight: 1.5 },
  docTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: 1, color: DARK, textAlign: "right" },
  docSub: { fontSize: 9, color: GRAY, textAlign: "right", marginTop: 4 },
  divider: { height: 2, backgroundColor: TERRACOTTA, marginBottom: 20 },
  thinDivider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 10 },

  workerBox: { backgroundColor: "#f9f5f2", borderRadius: 6, padding: 14, marginBottom: 20 },
  workerName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  workerMeta: { fontSize: 9, color: GRAY, lineHeight: 1.5 },

  periodBox: { flexDirection: "row", gap: 20, marginBottom: 20 },
  periodItem: { flex: 1 },
  periodLabel: { fontSize: 8, color: GRAY, marginBottom: 2 },
  periodValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  rowLabel: { fontSize: 10, color: GRAY },
  rowValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  netRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: TERRACOTTA, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 6, marginTop: 12 },
  netLabel: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  netValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  statusBadge: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 4, alignSelf: "flex-start" },

  footer: { position: "absolute", bottom: 30, left: 48, right: 48 },
  footerDivider: { height: 1, backgroundColor: "#e5e7eb", marginBottom: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#9ca3af" },

  signature: { marginTop: 40, flexDirection: "row", justifyContent: "space-between" },
  sigBox: { width: 150, borderTopWidth: 1, borderTopColor: DARK, paddingTop: 6 },
  sigLabel: { fontSize: 8, color: GRAY },
})

interface Payroll {
  id: string
  period_start: string
  period_end: string
  working_days: number
  days_present: number
  overtime_hours: number
  daily_wage: number
  overtime_rate: number
  deductions: number
  bonus: number
  net_salary: number
  status: string
  notes?: string | null
  worker?: {
    full_name: string
    department: string | null
    role: string
    phone?: string | null
  } | null
}

interface Props {
  payroll: Payroll
  org: Record<string, string> | null
}

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
}

export function PayslipPDFDocument({ payroll, org }: Props) {
  const orgName = org?.org_name || "KANRAD ERP"
  const orgAddress = [org?.address, org?.city, org?.state].filter(Boolean).join(", ")

  const basicWage = payroll.days_present * payroll.daily_wage
  const overtimePay = payroll.overtime_hours * payroll.overtime_rate
  const grossSalary = basicWage + overtimePay + (payroll.bonus ?? 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{orgName}</Text>
            {orgAddress ? <Text style={s.companyMeta}>{orgAddress}</Text> : null}
            {org?.phone ? <Text style={s.companyMeta}>Phone: {org.phone}</Text> : null}
            {org?.gstin ? <Text style={s.companyMeta}>GSTIN: {org.gstin}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>PAYSLIP</Text>
            <Text style={s.docSub}>Generated: {fmtDate(new Date().toISOString())}</Text>
            <View style={[s.statusBadge, {
              backgroundColor: payroll.status === "paid" ? "#dcfce7" : "#fef3c7",
            }]}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: payroll.status === "paid" ? "#16a34a" : "#d97706" }}>
                {payroll.status === "paid" ? "PAID" : "DRAFT"}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Worker Info */}
        <View style={s.workerBox}>
          <Text style={s.workerName}>{payroll.worker?.full_name ?? "—"}</Text>
          {payroll.worker?.department && <Text style={s.workerMeta}>Department: {payroll.worker.department}</Text>}
          <Text style={s.workerMeta}>Role: {payroll.worker?.role?.replace(/_/g, " ") ?? "—"}</Text>
          {payroll.worker?.phone && <Text style={s.workerMeta}>Phone: {payroll.worker.phone}</Text>}
        </View>

        {/* Pay Period */}
        <View style={s.periodBox}>
          <View style={s.periodItem}>
            <Text style={s.periodLabel}>Pay Period</Text>
            <Text style={s.periodValue}>{fmtDate(payroll.period_start)} – {fmtDate(payroll.period_end)}</Text>
          </View>
          <View style={s.periodItem}>
            <Text style={s.periodLabel}>Working Days</Text>
            <Text style={s.periodValue}>{payroll.working_days} days</Text>
          </View>
          <View style={s.periodItem}>
            <Text style={s.periodLabel}>Days Present</Text>
            <Text style={s.periodValue}>{payroll.days_present} days</Text>
          </View>
        </View>

        <View style={s.thinDivider} />

        {/* Earnings */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Earnings</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>Basic Wages ({payroll.days_present} days × {fmt(payroll.daily_wage)}/day)</Text>
            <Text style={s.rowValue}>{fmt(basicWage)}</Text>
          </View>
          {payroll.overtime_hours > 0 && (
            <View style={s.row}>
              <Text style={s.rowLabel}>Overtime ({payroll.overtime_hours} hrs × {fmt(payroll.overtime_rate)}/hr)</Text>
              <Text style={s.rowValue}>{fmt(overtimePay)}</Text>
            </View>
          )}
          {(payroll.bonus ?? 0) > 0 && (
            <View style={s.row}>
              <Text style={s.rowLabel}>Bonus / Incentive</Text>
              <Text style={s.rowValue}>{fmt(payroll.bonus)}</Text>
            </View>
          )}
          <View style={[s.row, { borderBottomWidth: 0 }]}>
            <Text style={[s.rowLabel, { fontFamily: "Helvetica-Bold" }]}>Gross Salary</Text>
            <Text style={s.rowValue}>{fmt(grossSalary)}</Text>
          </View>
        </View>

        <View style={s.thinDivider} />

        {/* Deductions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Deductions</Text>
          <View style={[s.row, { borderBottomWidth: 0 }]}>
            <Text style={s.rowLabel}>Total Deductions</Text>
            <Text style={[s.rowValue, { color: "#dc2626" }]}>{fmt(payroll.deductions ?? 0)}</Text>
          </View>
        </View>

        {/* Net Salary */}
        <View style={s.netRow}>
          <Text style={s.netLabel}>NET SALARY</Text>
          <Text style={s.netValue}>{fmt(payroll.net_salary)}</Text>
        </View>

        {payroll.notes ? (
          <View style={{ marginTop: 16, padding: 12, backgroundColor: "#f9f5f2", borderRadius: 4 }}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", letterSpacing: 1, marginBottom: 4 }}>NOTES</Text>
            <Text style={{ fontSize: 9, color: GRAY }}>{payroll.notes}</Text>
          </View>
        ) : null}

        {/* Signature */}
        <View style={s.signature}>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Employee Signature</Text>
          </View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Authorized Signatory</Text>
            <Text style={[s.sigLabel, { marginTop: 2 }]}>{orgName}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <View style={s.footerRow}>
            <Text style={s.footerText}>{orgName}</Text>
            <Text style={s.footerText}>This is a computer-generated payslip</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
