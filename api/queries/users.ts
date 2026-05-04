import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function upsertUser(data: InsertUser) {
  const values = { ...data };
  const updateSet: Partial<InsertUser> = {
    lastSignInAt: new Date(),
    ...data,
  };

  if (
    values.role === undefined &&
    values.unionId &&
    values.unionId === env.ownerUnionId
  ) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  try {
    await getDb()
      .insert(schema.users)
      .values(values)
      .onConflictDoUpdate({
        target: schema.users.unionId,
        set: updateSet,
      });
  } catch (error: any) {
    console.error("UPSERT USER ERROR FULL:", error);
    if (error instanceof Error) {
      console.error("UPSERT USER ERROR MESSAGE:", error.message);
      console.error("UPSERT USER ERROR CAUSE:", error.cause);
    }
    throw error;
  }
}
