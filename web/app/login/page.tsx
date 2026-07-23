import Image from "next/image";
import LoginForm from "./LoginForm";

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
      <p className="text-sm text-neutral-400">Sign in with your team account to continue.</p>
      <LoginForm />
    </main>
  );
}
