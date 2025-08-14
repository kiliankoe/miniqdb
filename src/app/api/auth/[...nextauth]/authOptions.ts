import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";

const prisma = new PrismaClient();

// In development, use a default secret if none is provided through env
if (process.env.NODE_ENV === "development" && !process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = "dev-secret-do-not-use-in-production";
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Development-only provider for automatic login
    ...(process.env.NODE_ENV === "development"
      ? [
          CredentialsProvider({
            name: "Development",
            credentials: {},
            async authorize() {
              return {
                id: "dev-user",
                email: "dev@localhost",
                name: "Dev User",
              };
            },
          }),
        ]
      : []),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify-request",
    error: "/login/error",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Always allow development user
      if (
        process.env.NODE_ENV === "development" &&
        account?.provider === "credentials"
      ) {
        return true;
      }

      if (user.email) {
        if (verifyEmail(user.email)) {
          return true;
        } else {
          return false;
        }
      }
      return false;
    },
    async jwt({ token, user }) {
      // For development user, ensure email is set
      if (user) {
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.email) {
        session.user = session.user ?? {};
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};

function verifyEmail(email: string) {
  const domain = email.split("@")[1];
  if (!process.env.ALLOWED_DOMAINS) {
    return true;
  }
  return process.env.ALLOWED_DOMAINS.split(",").includes(domain);
}
