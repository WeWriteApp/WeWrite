import "./globals.css"
import "./styles/scrollbar-hide.css"
import "./styles/loader.css"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "WeWrite - Home",
  description: "Create, collaborate, and share your writing with others in real-time",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://wewrite.app"),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={inter.className}>
        {children}
        <Analytics debug={process.env.NODE_ENV === 'development'} />
        <SpeedInsights />
      </body>
    </html>
  )
}