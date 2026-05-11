import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { getAuth, clerkClient } from "@clerk/express";
import {
  CreateUserBody,
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

const router: IRouter = Router();

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
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (existing) { res.json(GetCurrentUserResponse.parse(existing)); return; }

  // Auto-provision: fetch details from Clerk then create tenant + user
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkId}@unknown.local`;
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
  const avatarUrl = clerkUser.imageUrl ?? null;

  // Derive a unique tenant slug from the email domain or clerkId
  const domain = email.split("@")[1]?.replace(/\./g, "-") ?? clerkId.slice(0, 12);
  const baseSlug = domain.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const [tenant] = await db.insert(tenantsTable).values({
    name: name ?? email,
    slug,
    plan: "starter",
  }).returning();

  const [user] = await db.insert(usersTable).values({
    clerkId,
    email,
    name,
    avatarUrl,
    role: "admin",
    tenantId: tenant.id,
  }).returning();

  req.log.info({ userId: user.id, tenantId: tenant.id }, "Auto-provisioned user and tenant");
  res.json(GetCurrentUserResponse.parse(user));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.insert(usersTable).values({
    clerkId: parsed.data.clerkId,
    email: parsed.data.email,
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
