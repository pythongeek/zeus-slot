import * as cookie from "cookie";
import { setCookie } from "hono/cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { signSessionToken } from "./kimi/session";
import { upsertUser, findUserByUnionId } from "./queries/users";
import { env } from "./lib/env";
import { getDb } from "./queries/connection";
import { balances } from "../db/schema";
import { eq } from "drizzle-orm";

const DEMO_USER = {
  unionId: "demo-user-001",
  name: "Demo Player",
  avatar: null,
};

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  demoLogin: publicQuery.mutation(async ({ ctx }) => {
    if (env.appId !== "demo") {
      throw new Error("Demo login is only available in demo mode.");
    }
    try {
      const db = getDb();
      await upsertUser({
        unionId: DEMO_USER.unionId,
        name: DEMO_USER.name,
        avatar: DEMO_USER.avatar,
        lastSignInAt: new Date(),
      });
      const fullUser = await findUserByUnionId(DEMO_USER.unionId);
      if (fullUser) {
        const currencies = ["BTC", "ETH", "USDT", "BDT"] as const;
        for (const currency of currencies) {
          await db.insert(balances).values({
            userId: fullUser.id,
            currency,
            available: "1000",
            locked: "0",
            totalDeposited: "0",
            totalWithdrawn: "0",
          }).onConflictDoNothing();
        }
      }
    } catch (e: any) {
      const dbErr = `DB Error: ${e.message} | Code: ${e.code} | Detail: ${e.detail} | Hint: ${e.hint} | Table: ${e.table_name} | Column: ${e.column_name}`;
      throw new Error(dbErr);
    }
    const token = await signSessionToken({
      unionId: DEMO_USER.unionId,
      clientId: env.appId,
    });
    const cookieOpts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, token, {
        ...cookieOpts,
        maxAge: Session.maxAgeMs / 1000,
      }),
    );
    return { success: true };
  }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
