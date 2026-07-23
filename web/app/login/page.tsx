import Image from "next/image";
import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-dark p-8">
      <Image
        src="/brand/logo-horizontal-white-gold.png"
        alt="Luxury Desert Escapes"
        width={280}
        height={78}
        priority
        className="h-14 w-auto"
      />
      <p className="text-sm text-neutral-400">
        Sign in with your allowlisted Google account to continue.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-brand-gold px-5 py-2.5 font-medium text-brand-gold-contrast transition-colors hover:bg-brand-gold-hover"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
