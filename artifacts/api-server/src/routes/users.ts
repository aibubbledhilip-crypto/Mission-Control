import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, tenantsTable } from "@workspace/db";
import {
  UpdateUserBody,
  UpdateUserParams,
  GetUserParams,
  DeleteUserParams,
  ListUsersQueryParams,
  ListUsersResponse,
  GetUserResponse,
  UpdateUserResponse,
  GetCurrentUserResponse,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  role: z.enum(["superadmin", "admin", "operator", "viewer"]).optional(),
  tenantId: z.number().int(),
});

router.get("/users", async (req, res): Promise<void> => {
  const query = ListUsersQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const conditions = query.data.tenantId
    ? and(eq(usersTable.tenantId, query.data.tenantId))
    : undefined;
  const users = await db.select().from(usersTable).where(conditions).orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(users));
});

router.get("/users/me", async (req, res): Promise<void> => {
  if (!req.session?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(GetCurrentUserResponse.parse(user));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db.insert(usersTable).values({
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    name: parsed.data.name ?? null,
    avatarUrl: parsed.data.avatarUrl ?? null,
    role: parsed.data.role ?? "operator",
    tenantId: parsed.data.tenantId,
  }).returning();
  res.status(201).json(GetUserResponse.parse(user));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(GetUserResponse.parse(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(UpdateUserResponse.parse(user));
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.sendStatus(204);
});

export default router;
