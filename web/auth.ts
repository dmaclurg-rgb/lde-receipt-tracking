import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmails = new Set(
  (process.env.ALLOWED_TEAM_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return allowedEmails.has(user.email.toLowerCase());
    },
  },
});
