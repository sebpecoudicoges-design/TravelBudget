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

    async loadProgressionContext({ tables, userId, exerciseIds, historyLimit = 20, recentDays = 90 }) {
      const client = requireClient(getClient);
      const ids = [...new Set((exerciseIds || []).filter(Boolean))];
      if (!ids.length) return { metrics: [], history: [] };
      const metrics = unwrap(await client.from(tables.metrics)
        .select('exercise_id,smoothed_e1rm_kg,best_recent_weight_kg,best_recent_reps,best_recent_e1rm_kg,best_all_time_e1rm_kg,training_max_percentage,reference_weight_kg,calculated_at')
        .eq('user_id', userId)
        .in('exercise_id', ids));
      const recentSince = new Date(Date.now() - Math.max(1, recentDays) * 86400000).toISOString();
      const history = unwrap(await client.from(tables.history)
        .select('exercise_id,estimated_1rm_kg,created_at')
        .eq('user_id', userId)
        .in('exercise_id', ids)
        .gte('created_at', recentSince)
        .order('created_at', { ascending: false })
        .limit(historyLimit));
      return { metrics, history };
    },

    async saveProgression({ tables, rows }) {
      const client = requireClient(getClient);
      if (rows.metrics?.length) {
        unwrap(await client.from(tables.metrics).upsert(rows.metrics, { onConflict: 'user_id,exercise_id' }));
      }
      if (rows.history?.length) unwrap(await client.from(tables.history).insert(rows.history));
      if (rows.recommendations?.length) {
        unwrap(await client.from(tables.recommendations).upsert(rows.recommendations, {
          onConflict: 'user_id,exercise_id,source_session_id,program_exercise_id',
          ignoreDuplicates: false,
        }));
      }
      return true;
    },

    async loadRecommendations({ table, userId, status = 'pending', limit = 30 }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table)
        .select('id,user_id,exercise_id,program_exercise_id,source_session_id,current_program_weight_kg,heaviest_successful_weight_kg,heaviest_attempted_weight_kg,sets_at_heaviest_weight,recommended_weight_kg,increment_kg,reason_code,reason_text,confidence,status,accepted_at,created_at')
        .eq('user_id', userId)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(limit));
    },

    async loadExerciseMetricHistory({ table, userId, limit = 240 }) {
      const client = requireClient(getClient);
      return unwrap(await client.from(table)
        .select('id,user_id,exercise_id,session_id,weight_kg,reps,estimated_1rm_kg,smoothed_e1rm_kg,training_max_kg,reference_weight_kg,recommended_weight_kg,calculation_method,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit));
    },

    async setRecommendationStatus({ tables, recommendationId, userId, status }) {
      const client = requireClient(getClient);
      const allowed = new Set(['pending', 'accepted', 'rejected']);
      if (!allowed.has(status)) throw new Error('Statut de recommandation invalide');
      const timestamp = new Date().toISOString();
      const patch = { status, updated_at: timestamp };
      if (status === 'accepted') patch.accepted_at = timestamp;
      unwrap(await client.from(tables.recommendations).update(patch)
        .eq('id', recommendationId).eq('user_id', userId));
      return true;
    },

    async applyRecommendation({ tables, recommendation, userId, weightKg, scope = 'session_variant' }) {
      const client = requireClient(getClient);
      if (!recommendation?.id || !recommendation?.program_exercise_id) throw new Error('Recommandation non applicable');
      const nextWeight = Number(weightKg ?? recommendation.recommended_weight_kg);
      if (!Number.isFinite(nextWeight) || nextWeight < 0) throw new Error('Charge recommandee invalide');
      const timestamp = new Date().toISOString();
      let programUpdate = client.from(tables.programExercises).update({ default_weight_kg: nextWeight, updated_at: timestamp });
      if (scope === 'compatible_occurrences') {
        if (!tables.programSessions) throw new Error('Table sessions programme indisponible');
        const sourceRows = unwrap(await client.from(tables.programExercises)
          .select('id,session_id')
          .eq('id', recommendation.program_exercise_id)
          .limit(1));
        const sourceSessionId = sourceRows[0]?.session_id;
        if (!sourceSessionId) throw new Error('Seance programme source introuvable');
        const sessionRows = unwrap(await client.from(tables.programSessions)
          .select('id,program_id')
          .eq('id', sourceSessionId)
          .limit(1));
        const programId = sessionRows[0]?.program_id;
        if (!programId) throw new Error('Programme source introuvable');
        const compatibleSessions = unwrap(await client.from(tables.programSessions)
          .select('id')
          .eq('program_id', programId));
        const compatibleSessionIds = compatibleSessions.map((row) => row.id).filter(Boolean);
        if (!compatibleSessionIds.length) throw new Error('Aucune seance compatible');
        programUpdate = programUpdate.eq('exercise_key', recommendation.exercise_id).in('session_id', compatibleSessionIds);
      } else {
        programUpdate = programUpdate.eq('id', recommendation.program_exercise_id);
      }
      unwrap(await programUpdate);
      unwrap(await client.from(tables.recommendations).update({
        status: 'applied',
        accepted_at: recommendation.accepted_at || timestamp,
        applied_at: timestamp,
        updated_at: timestamp,
        application_scope: scope,
        previous_program_weight_kg: recommendation.current_program_weight_kg,
        recommended_weight_kg: nextWeight,
        modification_source: 'accepted_recommendation',
      }).eq('id', recommendation.id).eq('user_id', userId));
      return true;
    },
  };
}
