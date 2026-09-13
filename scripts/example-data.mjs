const font = "NotoSans";
const bold = "NotoSans-Bold";
const txt = (text, x, y, width, height, fontSize = 12, extra = {}) => ({
  type: "TEXT",
  text,
  x,
  y,
  width,
  height,
  font,
  fontSize,
  ...extra,
});
export const examples = {
  invoice: {
    template: {
      version: 1,
      title: "Invoice draft · PDFAlarm Engine",
      pages: [
        {
          width: 595.28,
          height: 841.89,
          elements: [
            {
              type: "RECTANGLE",
              x: 0,
              y: 0,
              width: 595.28,
              height: 12,
              fill: "#237B65",
            },
            txt("INVOICE DRAFT", 40, 40, 390, 44, 28, { font: bold }),
            txt("{{invoice.number}}", 420, 48, 130, 26, 12, { align: "right" }),
            txt("North Studio · Sample document", 40, 91, 450, 24, 11, {
              color: "#60716C",
            }),
            txt("BILL TO", 40, 148, 250, 24, 10, {
              font: bold,
              color: "#237B65",
            }),
            txt("{{customer.name}}", 40, 175, 370, 32, 18, { font: bold }),
            txt("{{customer.address}}", 40, 212, 420, 52, 11),
            {
              type: "TEXT",
              dataField: "invoice.date",
              formatter: { type: "date", locale: "en-GB" },
              x: 400,
              y: 151,
              width: 155,
              height: 30,
              font,
              fontSize: 11,
              align: "right",
            },
            txt("Total: {{invoice.total}}", 40, 273, 430, 38, 20, {
              font: bold,
            }),
            txt(
              "Illustrative draft. Not a tax-compliant invoice.",
              40,
              316,
              480,
              30,
              10,
              { color: "#60716C" },
            ),
            {
              type: "TABLE",
              x: 40,
              y: 378,
              width: 515.28,
              height: 385,
              font,
              fontSize: 10,
              headerFont: bold,
              dataPath: "items",
              topMargin: 70,
              bottomMargin: 55,
              columns: [
                { header: "Description", path: "description", width: 295.28 },
                {
                  header: "Qty",
                  path: "quantity",
                  width: 70,
                  align: "right",
                  formatter: { type: "number", decimals: 0 },
                },
                {
                  header: "Amount",
                  path: "amount",
                  width: 150,
                  align: "right",
                  formatter: {
                    type: "currency",
                    locale: "en-GB",
                    currency: "EUR",
                  },
                },
              ],
            },
          ],
          continuationElements: [
            txt("North Studio · Invoice continuation", 40, 27, 515, 25, 11, {
              font: bold,
            }),
            txt("Sample data · PDFAlarm Engine", 40, 803, 515, 20, 9, {
              color: "#60716C",
            }),
          ],
        },
      ],
    },
    data: {
      invoice: {
        number: "INV-2026-041",
        date: "2026-09-13",
        total: "€1,480.00",
      },
      customer: { name: "İpek Yılmaz", address: "Şişli, İstanbul · Türkiye" },
      items: [
        {
          description: "Brand identity and visual direction",
          quantity: 1,
          amount: 780,
        },
        {
          description: "Product photography · sample service",
          quantity: 2,
          amount: 500,
        },
        {
          description: "Print preparation and delivery",
          quantity: 1,
          amount: 200,
        },
      ],
    },
  },
  label: {
    template: {
      version: 1,
      title: "Shipping label · PDFAlarm Engine",
      pages: [
        {
          width: 420,
          height: 595,
          elements: [
            {
              type: "RECTANGLE",
              x: 20,
              y: 20,
              width: 380,
              height: 555,
              stroke: "#DCE4E2",
            },
            txt("PARCEL / 01", 40, 40, 340, 40, 25, { font: bold }),
            txt("DEMO SHIPPING LABEL", 40, 92, 340, 22, 10, {
              color: "#60716C",
            }),
            txt("{{recipient.name}}", 40, 146, 340, 32, 19, { font: bold }),
            txt("{{recipient.address}}", 40, 189, 340, 66, 13),
            {
              type: "BARCODE",
              x: 40,
              y: 291,
              width: 340,
              height: 74,
              dataField: "tracking",
              font,
            },
            {
              type: "QR_CODE",
              x: 40,
              y: 406,
              width: 104,
              height: 104,
              dataField: "url",
            },
            txt(
              "Scan for the sample project.\nNo shipment has been created.",
              167,
              426,
              200,
              63,
              11,
            ),
            txt("Generated with PDFAlarm Engine", 40, 537, 340, 22, 9, {
              color: "#60716C",
            }),
          ],
        },
      ],
    },
    data: {
      recipient: {
        name: "İpek Yılmaz",
        address: "Örnek Sokak 12\n34360 Şişli, İstanbul\nTürkiye",
      },
      tracking: "PDFALARM-2026-041",
      url: "https://github.com/ads-dotcom/pdfalarm-engine",
    },
  },
  certificate: {
    template: {
      version: 1,
      title: "Certificate · PDFAlarm Engine",
      pages: [
        {
          width: 841.89,
          height: 595.28,
          elements: [
            {
              type: "RECTANGLE",
              x: 26,
              y: 26,
              width: 789.89,
              height: 543.28,
              stroke: "#237B65",
              strokeWidth: 2,
            },
            txt("NORTH STUDIO", 70, 73, 701, 25, 11, {
              font: bold,
              align: "center",
              color: "#237B65",
            }),
            txt("Certificate of completion", 70, 137, 701, 60, 34, {
              font: bold,
              align: "center",
            }),
            txt(
              "This sample certificate is presented to",
              70,
              224,
              701,
              30,
              13,
              { align: "center", color: "#60716C" },
            ),
            txt("{{name}}", 70, 273, 701, 60, 36, {
              font: bold,
              align: "center",
            }),
            txt("for completing {{course}}.", 90, 357, 660, 55, 14, {
              align: "center",
            }),
            txt(
              "A demonstration document using fictional data.",
              70,
              441,
              701,
              27,
              10,
              { align: "center", color: "#60716C" },
            ),
            txt("PDFAlarm Engine · Open source", 70, 505, 701, 22, 10, {
              align: "center",
              color: "#237B65",
            }),
          ],
        },
      ],
    },
    data: { name: "İpek Yılmaz", course: "the creative systems workshop" },
  },
};
