import { MCP_HEALTH_COLUMNS } from './mcpHealthCatalog.js';
// Closed column list shared by the repositories. Never accept a client column list.
export const MCP_COLUMNS = {
  ...MCP_HEALTH_COLUMNS,
  wallets: 'id,user_id,name,currency,balance,balance_snapshot_at,period_id,travel_id,archived',
  transactions: 'id,user_id,wallet_id,type,amount,currency,category,subcategory,label,date_start,date_end,budget_date_start,budget_date_end,paid_at,created_at,updated_at,pay_now,is_internal,affects_budget,out_of_budget,period_id,travel_id,trip_expense_id,trip_share_link_id,recurring_instance_status,detached_trip_payment',
  periods: 'id,user_id,travel_id,start_date,end_date,base_currency,daily_budget_base,eur_base_rate',
  budget_segments: 'id,user_id,period_id,start_date,end_date,base_currency,daily_budget_base,transport_night_budget,fx_mode,eur_base_rate_fixed,fx_rate_eur_to_base,sort_order',
  travels: 'id,user_id,name,base_currency,start_date,end_date',
  trip_groups: 'id,user_id,period_id,name,base_currency,closed_at',
  categories: 'id,user_id,name',
  assets: 'id,user_id,travel_id,name,asset_type,purchase_value,residual_value,currency,purchase_date,depreciation_months,status,include_in_budget,budget_method,monthly_budget_override,budget_start_date,budget_end_date,budget_day,budget_category,budget_subcategory',
  asset_owners: 'id,user_id,asset_id,display_name,ownership_percent',
  asset_transaction_links: 'id,user_id,asset_id,transaction_id,relation_type,exclude_from_budget',
  trip_members: 'id,user_id,trip_id,name,is_me',
  trip_expenses: 'id,user_id,trip_id,date,label,amount,currency,paid_by_member_id,category,subcategory,budget_date_start,budget_date_end,kind,income_source,income_due_back',
  trip_expense_shares: 'id,user_id,trip_id,expense_id,member_id,share_amount',
  trip_settlement_events: 'id,user_id,trip_id,currency,amount,from_member_id,to_member_id,created_at,cancelled_at',
  documents: 'id,user_id,name,original_filename,mime_type,size_bytes,updated_at',
};

export async function readMcpPage({client,userId},table,{offset=0,limit=100}={}) {
  if(!Object.hasOwn(MCP_COLUMNS,table))throw new Error('Read table denied');
  const {data,error}=await client.from(table).select(MCP_COLUMNS[table]).eq('user_id',userId).order('id',{ascending:true}).range(offset,offset+limit);
  if(error||!Array.isArray(data)||data.some(row=>row.user_id!==userId))throw new Error('Read refused or incomplete');
  return {rows:data.slice(0,limit).map(row=>Object.fromEntries(MCP_COLUMNS[table].split(',').filter(key=>key!=='user_id').map(key=>[key,row[key]??null]))),next_offset:data.length>limit?offset+limit:null};
}

export function createMcpRows({ client, userId }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '') || typeof client?.from !== 'function') throw new Error('Verified user context required');
  return async (table, filters = {}) => {
    if (!Object.hasOwn(MCP_COLUMNS, table)) throw new Error('Read table denied');
    const rows = [];
    for (let offset = 0; offset <= 10000; offset += 500) {
      let q = client.from(table).select(MCP_COLUMNS[table]).eq('user_id', userId).order('id', {ascending:true});
      for (const [key,value] of Object.entries(filters)) q=q.eq(key,value);
      const {data,error}=await q.range(offset,offset+499);
      if (error || !Array.isArray(data) || data.some(row=>row.user_id!==userId)) throw new Error('Read refused or incomplete');
      rows.push(...data.map(row=>Object.fromEntries(MCP_COLUMNS[table].split(',').filter(key=>key!=='user_id').map(key=>[key,row[key]??null]))));
      if(rows.length>10000)throw new Error('Read limit exceeded');
      if(data.length<500)return rows;
    }
    throw new Error('Incomplete read');
  };
}
