export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; color: #1a1a1a; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            @page { size: A4; margin: 0; }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
