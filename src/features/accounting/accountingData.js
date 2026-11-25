import { computeWalletBalanceRows } from '../../core/walletBalanceRules.js';

export async function readPages(query, orderBy = ['id']) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    let request = query();
    for (const key of orderBy) request = request.order(key, { ascending: true });
    const result = await request.range(from, from + 499);
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
    if ((result.data || []).length < 500) return rows;
  }
}

// Read-only; RLS is retained and account/travel filters bound the requested data.
export async function loadAccountingData({ client, userId, travelId }) {
  if (!client || !userId || !travelId) throw new Error('Compte ou voyage indisponible.');
  const results = await Promise.allSettled([
    readPages(() => client.from('transactions').select('*').eq('user_id', userId).eq('travel_id', travelId)),
    readPages(() => client.from('wallets').select('*').eq('user_id', userId).eq('travel_id', travelId)),
    readPages(() => client.from('assets').select('*').eq('user_id', userId)),
    readPages(() => client.from('asset_transaction_links').select('*').eq('user_id', userId)),
    readPages(() => client.from('v_trip_user_net_balances').select('trip_id,trip_name,currency,net'), ['trip_id', 'currency']),
  ]);
  const failure = results.slice(0,4).find(r => r.status === 'rejected');
  if (failure) throw failure.reason;
  const [transactions, wallets, assets, links] = results.map(r => r.value);
  const owners = [];
  for (let i = 0; i < assets.length; i += 100) owners.push(...await readPages(() => client.from('asset_owners').select('*').in('asset_id', assets.slice(i, i + 100).map(a => a.id))));
  return { tripBalances: results[4].status === 'fulfilled' ? results[4].value : null, transactions, wallets, assets, links, owners, walletBalances: computeWalletBalanceRows(wallets, transactions), partial: false };
}

export const settingsKey = (userId, travelId) => `tb-accounting-v1:${encodeURIComponent(userId)}:${encodeURIComponent(travelId)}`;
export function readSettings(storage, userId, travelId) {
  const raw = storage.getItem(settingsKey(userId, travelId));
  const settings = raw === null ? {} : JSON.parse(raw);
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Paramétrage local illisible.');
  return [settings, raw];
}

export function saveSettings(storage, userId, travelId, settings, previous) {
  if (!userId || !travelId) throw new Error('Compte ou voyage indisponible.');
  const key = settingsKey(userId, travelId);
  if (storage.getItem(key) !== previous) throw new Error('Réglages modifiés dans un autre onglet. Actualise la comptabilité avant de ressaisir ta modification.');
  const raw = JSON.stringify(settings);
  storage.setItem(key, raw);
  return raw;
}
