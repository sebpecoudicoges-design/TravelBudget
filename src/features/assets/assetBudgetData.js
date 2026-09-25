// Budget consumers load the data without loading the Patrimoine UI or demo rows.
export async function loadAssetBudgetData({ client, state, offline = false, isCurrent = () => true }) {
  if (offline || !client?.from) return false;
  const { data: assets, error } = await client.from('assets').select('*').neq('status', 'archived');
  if (error) throw error;
  const rows = assets || [];
  const owners = rows.length ? await client.from('asset_owners').select('*').in('asset_id', rows.map(row => row.id)) : { data: [] };
  if (owners.error) throw owners.error;
  if (!isCurrent()) return false;
  state.assets = rows;
  state.assetOwners = owners.data || [];
  return true;
}
