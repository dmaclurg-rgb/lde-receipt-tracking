import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LDE Receipt Tracking",
  description: "Company receipt & expense reconciliation for Luxury Desert Escapes",
};

const NAV_ITEMS = [
  { href: "/receipts/new", label: "Add Receipt" },
  { href: "/statements", label: "Upload Statement" },
  { href: "/review", label: "Review" },
  { href: "/reports", label: "Reports" },
  { href: "/subscriptions", label: "Subscriptions" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {session && (
          <header className="border-b border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
              <nav className="flex flex-wrap gap-4 text-sm font-medium">
                <Link href="/">LDE Receipts</Link>
                {NAV_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-3 text-sm text-neutral-500">
                <span>{session.user?.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button type="submit" className="underline">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>
        )}
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
