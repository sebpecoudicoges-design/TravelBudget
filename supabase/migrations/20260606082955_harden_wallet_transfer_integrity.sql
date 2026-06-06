-- Keep wallet transfer rows coherent even if they are written directly through
-- the Data API instead of the create_wallet_transfer_v1 RPC.

create or replace function public.wallet_transfers_consistency_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_from_wallet public.wallets%rowtype;
  v_to_wallet public.wallets%rowtype;
  v_expected_travel_id uuid;
begin
  if new.user_id is null or new.from_wallet_id is null or new.to_wallet_id is null then
    raise exception 'Wallet transfer requires user_id, from_wallet_id and to_wallet_id';
  end if;

  if new.from_wallet_id = new.to_wallet_id then
    raise exception 'Source and destination wallets must be different';
  end if;

  select * into v_from_wallet
  from public.wallets
  where id = new.from_wallet_id;

  if not found or v_from_wallet.user_id <> new.user_id then
    raise exception 'Source wallet not found or not owned';
  end if;

  select * into v_to_wallet
  from public.wallets
  where id = new.to_wallet_id;

  if not found or v_to_wallet.user_id <> new.user_id then
    raise exception 'Destination wallet not found or not owned';
  end if;

  if v_from_wallet.travel_id is not null
     and v_to_wallet.travel_id is not null
     and v_from_wallet.travel_id <> v_to_wallet.travel_id then
    raise exception 'Source and destination wallets must belong to the same travel';
  end if;

  v_expected_travel_id := coalesce(v_from_wallet.travel_id, v_to_wallet.travel_id);
  if new.travel_id is null then
    new.travel_id := v_expected_travel_id;
  elsif v_expected_travel_id is not null and new.travel_id <> v_expected_travel_id then
    raise exception 'Wallet transfer travel does not match source/destination wallets';
  end if;

  new.from_currency := upper(trim(coalesce(new.from_currency, v_from_wallet.currency)));
  new.to_currency := upper(trim(coalesce(new.to_currency, v_to_wallet.currency)));
  new.fee_currency := nullif(upper(trim(coalesce(new.fee_currency, ''))), '');
  new.category := trim(coalesce(new.category, ''));
  new.subcategory := nullif(trim(coalesce(new.subcategory, '')), '');
  new.fee_category := nullif(trim(coalesce(new.fee_category, '')), '');
  new.fee_subcategory := nullif(trim(coalesce(new.fee_subcategory, '')), '');
  new.label := coalesce(nullif(trim(coalesce(new.label, '')), ''), 'Mouvement interne');
  new.note := nullif(trim(coalesce(new.note, '')), '');

  if new.from_currency <> upper(trim(v_from_wallet.currency)) then
    raise exception 'Source currency does not match source wallet';
  end if;

  if new.to_currency <> upper(trim(v_to_wallet.currency)) then
    raise exception 'Destination currency does not match destination wallet';
  end if;

  if coalesce(new.from_amount, 0) <= 0 or coalesce(new.to_amount, 0) <= 0 then
    raise exception 'Transfer amounts must be positive';
  end if;

  if nullif(new.category, '') is null then
    raise exception 'Category is required';
  end if;

  return new;
end;
$function$;

drop trigger if exists wallet_transfers_consistency_guard on public.wallet_transfers;
create trigger wallet_transfers_consistency_guard
before insert or update on public.wallet_transfers
for each row execute function public.wallet_transfers_consistency_guard();

revoke execute on function public.wallet_transfers_consistency_guard() from public;
revoke execute on function public.wallet_transfers_consistency_guard() from anon;
revoke execute on function public.wallet_transfers_consistency_guard() from authenticated;
