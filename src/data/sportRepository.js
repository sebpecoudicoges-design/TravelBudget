function requireClient(getClient) {
  const client = typeof getClient === 'function' ? getClient() : getClient;
  if (!client || typeof client.from !== 'function') throw new Error('Supabase indisponible');
  return client;
}

function unwrap(result) {
  if (result?.error) throw result.error;
  return result?.data || [];
}

export function createSportRepository(getClient) {
  return {
    async loadHistory({ tables, userId, limit = 20 }) {
      const client = requireClient(getClient);
      const sessions = unwrap(await client
        .from(tables.sessions)
        .select('id,user_id,travel_id,activity_type,started_at,ended_at,duration_seconds,mood_before,mood_after,energy,fatigue,pain,body_weight_kg,notes,estimated_kcal,created_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit));
      const sessionIds = sessions.map((row) => row.id).filter(Boolean);
      if (!sessionIds.length) return { sessions, items: [], sets: [] };

      const items = unwrap(await client
        .from(tables.items)
        .select('id,user_id,session_id,activity_key,exercise_name,equipment,mode,target_reps,target_seconds,distance_m,planned_sets,rest_seconds,sort_order,met_value,notes')
        .in('session_id', sessionIds)
        .order('sort_order', { ascending: true }));
      const itemIds = items.map((row) => row.id).filter(Boolean);
      if (!itemIds.length) return { sessions, items, sets: [] };

      const sets = unwrap(await client
        .from(tables.sets)
        .select('id,user_id,item_id,set_index,reps,duration_seconds,weight_kg,distance_m,completed_at,perceived_effort,notes')
        .in('item_id', itemIds)
        .order('set_index', { ascending: true }));
      return { sessions, items, sets };
    },

    async findExistingWorkout({ table, userId, activityType, startedAt, durationSeconds }) {
      if (!startedAt || !durationSeconds) return null;
      const client = requireClient(getClient);
      const rows = unwrap(await client
        .from(table)
        .select('id,created_at')
        .eq('user_id', userId)
        .eq('activity_type', activityType)
        .eq('started_at', startedAt)
        .eq('duration_seconds', durationSeconds)
        .order('created_at', { ascending: true })
        .limit(1));
      return rows[0]?.id || null;
    },

    async createWorkout({ tables, rows }) {
      const client = requireClient(getClient);
      const session = unwrap(await client.from(tables.sessions).insert([rows.session]).select('id').single());
      const sessionId = session?.id;
      const itemRows = (rows.items || []).map((item) => ({ ...item, session_id: sessionId }));
      if (!itemRows.length) return { sessionId, itemIds: [] };

      const items = unwrap(await client.from(tables.items).insert(itemRows).select('id,sort_order'));
      const itemByIndex = new Map(items.map((item) => [Number(item.sort_order), item.id]));
      const setRows = (rows.sets || []).map((set) => {
        const { itemIndex, ...payload } = set;
        return { ...payload, item_id: itemByIndex.get(Number(itemIndex)) };
      }).filter((set) => set.item_id);
      if (setRows.length) unwrap(await client.from(tables.sets).insert(setRows));
      return { sessionId, itemIds: items.map((item) => item.id).filter(Boolean) };
    },

    async deleteWorkout({ tables, sessionId, itemIds = [] }) {
      const client = requireClient(getClient);
      let ids = (itemIds || []).filter(Boolean);
      if (!ids.length) {
        ids = unwrap(await client.from(tables.items).select('id').eq('session_id', sessionId))
          .map((item) => item.id)
          .filter(Boolean);
      }
      if (ids.length) unwrap(await client.from(tables.sets).delete().in('item_id', ids));
      unwrap(await client.from(tables.items).delete().eq('session_id', sessionId));
      unwrap(await client.from(tables.sessions).delete().eq('id', sessionId));
      return true;
    },

    async updateSessionDate({ table, sessionId, startedAt, endedAt }) {
      const client = requireClient(getClient);
      unwrap(await client.from(table).update({ started_at: startedAt, ended_at: endedAt }).eq('id', sessionId));
      return true;
    },
  };
}
