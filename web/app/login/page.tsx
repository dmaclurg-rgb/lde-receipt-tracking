import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">LDE Receipt Tracking</h1>
      <p className="text-sm text-neutral-500">
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
          className="rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
