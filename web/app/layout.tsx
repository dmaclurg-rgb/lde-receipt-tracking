import type { Metadata } from "next";
import { Source_Sans_3, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { currentAdmin } from "@/lib/admin";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
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
  { href: "/supplies", label: "Supplies" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const admin = session ? await currentAdmin() : null;
  const navItems = admin ? [...NAV_ITEMS, { href: "/team", label: "Team" }] : NAV_ITEMS;

  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {session && (
          <header className="bg-brand-dark border-b border-black/20">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-5">
                <Link href="/" className="flex items-center">
                  <Image
                    src="/brand/logo-horizontal-white-gold.png"
                    alt="Luxury Desert Escapes"
                    width={180}
                    height={50}
                    priority
                    className="h-9 w-auto"
                  />
                </Link>
                <nav className="flex flex-wrap gap-4 text-sm font-medium">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="text-neutral-300 transition-colors hover:text-brand-gold"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-400">
                <span>{session.user?.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button type="submit" className="text-neutral-300 underline hover:text-brand-gold">
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
