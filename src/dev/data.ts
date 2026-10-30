/**
 * Developer-mode data access: who may do what, and the plant-candidate reviews. Backed by Supabase (RLS decides,
 * see supabase.sql) or, in local development without a database, by memory
 * so the workbench can be checked on sample data.
 */
import { supabase } from "../lib/supabase.ts";
import type { ResponseRow } from "../lib/answers.ts";

export type Role = "owner" | "editor" | "viewer";
export type Member = { email: string; role: Role; invited_by?: string | null; created_at?: string };
export type ReviewStatus = "candidate" | "shortlisted" | "excluded";
export type Review = {
  name_key: string;
  reviewed_name: string | null;
  status: ReviewStatus;
  merged_into: string | null;
  notes: string | null;
};

export interface DevStore {
  /** The signed-in account’s role, or null when it is not a member. */
  role(): Promise<Role | null>;
  responses(): Promise<ResponseRow[]>;
  members(): Promise<Member[]>;
  grant(email: string, role: Exclude<Role, "owner">): Promise<void>;
  setRole(email: string, role: Exclude<Role, "owner">): Promise<void>;
  remove(email: string): Promise<void>;
  reviews(): Promise<Review[]>;
  saveReview(review: Review): Promise<void>;
  clearReview(nameKey: string): Promise<void>;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function supabaseStore(email: string): DevStore {
  const db = supabase!;
  const me = email.toLowerCase();
  return {
    async role() {
      const { data, error } = await db.from("dev_members").select("role").eq("email", me).maybeSingle();
      // A non-member gets no row back (RLS), which is the same as "not a member".
      if (error) return null;
      return (data?.role as Role | undefined) ?? null;
    },
    async responses() {
      const all: ResponseRow[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await db.from("responses").select("*").order("submitted_at", { ascending: true }).range(from, from + page - 1);
        fail(error);
        all.push(...((data ?? []) as ResponseRow[]));
        if (!data || data.length < page) break;
      }
      return all;
    },
    async members() {
      const { data, error } = await db.from("dev_members").select("*").order("created_at", { ascending: true });
      fail(error);
      return (data ?? []) as Member[];
    },
    async grant(target, role) {
      const { error } = await db.from("dev_members").insert({ email: target.toLowerCase().trim(), role, invited_by: me });
      fail(error);
    },
    async setRole(target, role) {
      const { error } = await db.from("dev_members").update({ role }).eq("email", target);
      fail(error);
    },
    async remove(target) {
      const { error } = await db.from("dev_members").delete().eq("email", target);
      fail(error);
    },
    async reviews() {
      const { data, error } = await db.from("plant_reviews").select("*");
      fail(error);
      return (data ?? []) as Review[];
    },
    async saveReview(review) {
      const { error } = await db.from("plant_reviews").upsert({ ...review, updated_by: me, updated_at: new Date().toISOString() });
      fail(error);
    },
    async clearReview(nameKey) {
      const { error } = await db.from("plant_reviews").delete().eq("name_key", nameKey);
      fail(error);
    },
  };
}

/** In-memory store for local development without a database: the visitor acts as owner over sample data. */
export function memoryStore(rows: ResponseRow[]): DevStore {
  const members: Member[] = [{ email: "kayyan1998@gmail.com", role: "owner" }];
  const reviews = new Map<string, Review>();
  return {
    async role() {
      return "owner";
    },
    async responses() {
      return rows;
    },
    async members() {
      return [...members];
    },
    async grant(email, role) {
      const e = email.toLowerCase().trim();
      if (members.some((m) => m.email === e)) throw new Error("Already a member");
      members.push({ email: e, role, invited_by: members[0].email });
    },
    async setRole(email, role) {
      const m = members.find((x) => x.email === email);
      if (m && m.role !== "owner") m.role = role;
    },
    async remove(email) {
      const i = members.findIndex((x) => x.email === email && x.role !== "owner");
      if (i >= 0) members.splice(i, 1);
    },
    async reviews() {
      return [...reviews.values()];
    },
    async saveReview(review) {
      reviews.set(review.name_key, review);
    },
    async clearReview(nameKey) {
      reviews.delete(nameKey);
    },
  };
}

export function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
