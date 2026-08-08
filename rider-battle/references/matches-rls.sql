-- Rider Battle — Supabase Row-Level Security for public.matches
-- Goal: the anon/publishable key can READ, INSERT a fresh PENDING row, and advance
-- status through legal transitions ONLY. It can NEVER write winner / settle_sig, and
-- may set settle_tx only on funded->settled. winner/settle_sig/settle_tx of record are
-- owned by the service-role backend (settle-battle edge function).
-- Adapt column names to your schema. Run in: Supabase → SQL Editor → New query → Run.

-- 1) Enable RLS
alter table public.matches enable row level security;

-- 2) READ: anyone may read (lobby/leaderboard need it)
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches
  for select using (true);

-- 3) INSERT: anon may only create a fresh PENDING row, never pre-setting trusted fields
drop policy if exists matches_insert_pending on public.matches;
create policy matches_insert_pending on public.matches
  for insert
  with check (
    status = 'pending'
    and winner is null
    and settle_sig is null
    and settle_tx is null
    and opponent is null
  );

-- 4) UPDATE: allowed, but the trigger below enforces column immutability + legal moves
drop policy if exists matches_update on public.matches;
create policy matches_update on public.matches
  for update using (true) with check (true);

-- 5) Guard trigger: block anon writes to winner/settle_sig, restrict settle_tx + transitions.
--    service_role (backend) bypasses these checks.
create or replace function public.matches_guard_update()
returns trigger language plpgsql as $$
declare
  role text := coalesce(auth.role(), 'anon');  -- if unavailable use coalesce(auth.jwt()->>'role','anon')
begin
  if role = 'service_role' then
    return new;                                  -- settle-battle edge fn may do anything
  end if;

  if new.winner   is distinct from old.winner   then raise exception 'winner not writable by anon'; end if;
  if new.settle_sig is distinct from old.settle_sig then raise exception 'settle_sig not writable by anon'; end if;

  if new.settle_tx is distinct from old.settle_tx
     and not (old.status = 'funded' and new.status = 'settled')
  then raise exception 'settle_tx only writable on funded->settled'; end if;

  if new.status is distinct from old.status
     and not (
       (old.status = 'pending' and new.status in ('open','refunded'))
       or (old.status = 'open'    and new.status = 'funded')
       or (old.status = 'open'    and new.status = 'refunded')
       or (old.status = 'funded'  and new.status in ('settled','refunded'))
     )
  then raise exception 'illegal status transition % -> %', old.status, new.status; end if;

  return new;
end $$;

drop trigger if exists trg_matches_guard_update on public.matches;
create trigger trg_matches_guard_update
  before update on public.matches
  for each row execute function public.matches_guard_update();

-- 6) IMPORTANT: the settle-battle edge function MUST use the SERVICE_ROLE key (not anon),
--    otherwise it will be blocked from writing winner/settle_sig after this is applied.
