// Thin wrappers around the gallery-members function (design 9): the owner lists, invites and removes staff.
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../lib/database.types';

export type Member = { userId: string; email: string | null; role: 'owner' | 'staff'; invitedAt: string | null; confirmed: boolean };
export type MemberError =
  | 'not_owner'
  | 'invalid_email'
  | 'already_member'
  | 'member_elsewhere'
  | 'cannot_remove_self'
  | 'cannot_remove_owner'
  | 'not_member'
  | 'offline'
  | 'internal';
const KNOWN = new Set<string>(['not_owner', 'invalid_email', 'already_member', 'member_elsewhere', 'cannot_remove_self', 'cannot_remove_owner', 'not_member']);

type Client = SupabaseClient<Database>;

async function call<T>(client: Client, name: string, method: 'GET' | 'POST' | 'DELETE', body?: object): Promise<T | { error: MemberError }> {
  const { data, error } = await client.functions.invoke<T>(name, { method, body });
  if (!error) return data as T;
  if (!(error instanceof FunctionsHttpError)) return { error: 'offline' }; // never reached the function
  const code = await (error.context as Response)
    .json()
    .then((b: { error?: string }) => b.error)
    .catch(() => undefined);
  return { error: code && KNOWN.has(code) ? (code as MemberError) : 'internal' };
}

export const listMembers = (client: Client, galleryId: string) =>
  call<{ members: Member[] }>(client, `gallery-members?galleryId=${encodeURIComponent(galleryId)}`, 'GET');

export const inviteMember = (client: Client, galleryId: string, email: string) =>
  call<{ userId: string; invited: boolean }>(client, 'gallery-members', 'POST', { galleryId, email });

export const removeMember = (client: Client, galleryId: string, userId: string) =>
  call<{ removed: true }>(client, 'gallery-members', 'DELETE', { galleryId, userId });
