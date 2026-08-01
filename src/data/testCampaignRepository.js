function unwrap(result, fallback = []) {
  if (result?.error) throw result.error;
  return result?.data ?? fallback;
}

export function createTestCampaignRepository(client) {
  if (!client?.from) throw new Error('Client Supabase indisponible');

  return {
    async loadActiveCampaign(userId) {
      if (!userId) throw new Error('Utilisateur non authentifie');
      const campaign = unwrap(await client
        .from('app_test_campaigns')
        .select('id,slug,title,description,app_version,status,starts_at,ends_at')
        .eq('status', 'active')
        .order('starts_at', { ascending: false })
        .limit(1)
        .maybeSingle(), null);
      if (!campaign) return null;

      const [modulesRes, scenariosRes, resultsRes, reviewsRes] = await Promise.all([
        client.from('app_test_modules')
          .select('id,campaign_id,module_key,title,description,instructions,sort_order,status,archived_at,archive_reason')
          .eq('campaign_id', campaign.id)
          .order('sort_order', { ascending: true }),
        client.from('app_test_scenarios')
          .select('id,campaign_id,module_id,title,instructions,expected_result,required,sort_order')
          .eq('campaign_id', campaign.id)
          .order('sort_order', { ascending: true }),
        client.from('app_test_results')
          .select('id,scenario_id,status,notes,completed_at,treated_at,archived_at,treated_version,treatment_notes,updated_at')
          .eq('campaign_id', campaign.id)
          .eq('user_id', userId),
        client.from('app_test_module_reviews')
          .select('id,module_id,status,notes,completed_at,treated_at,archived_at,treated_version,treatment_notes,updated_at')
          .eq('campaign_id', campaign.id)
          .eq('user_id', userId),
      ]);

      return {
        campaign,
        modules: unwrap(modulesRes),
        scenarios: unwrap(scenariosRes),
        results: unwrap(resultsRes),
        reviews: unwrap(reviewsRes),
      };
    },

    async saveScenarioResult({ campaignId, scenarioId, userId, status, notes }) {
      const existing = unwrap(await client
        .from('app_test_results')
        .select('id')
        .eq('scenario_id', scenarioId)
        .eq('user_id', userId)
        .is('archived_at', null)
        .maybeSingle(), null);
      const payload = {
        campaign_id: campaignId,
        scenario_id: scenarioId,
        user_id: userId,
        status,
        notes: String(notes || '').trim() || null,
        completed_at: status === 'pending' ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const request = existing?.id
        ? client.from('app_test_results').update(payload).eq('id', existing.id)
        : client.from('app_test_results').insert(payload);
      return unwrap(await request
        .select('id,scenario_id,status,notes,completed_at,treated_at,archived_at,treated_version,treatment_notes,updated_at')
        .single(), null);
    },

    async saveModuleReview({ campaignId, moduleId, userId, status, notes }) {
      const existing = unwrap(await client
        .from('app_test_module_reviews')
        .select('id')
        .eq('module_id', moduleId)
        .eq('user_id', userId)
        .is('archived_at', null)
        .maybeSingle(), null);
      const payload = {
        campaign_id: campaignId,
        module_id: moduleId,
        user_id: userId,
        status,
        notes: String(notes || '').trim() || null,
        completed_at: status === 'in_progress' ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const request = existing?.id
        ? client.from('app_test_module_reviews').update(payload).eq('id', existing.id)
        : client.from('app_test_module_reviews').insert(payload);
      return unwrap(await request
        .select('id,module_id,status,notes,completed_at,treated_at,archived_at,treated_version,treatment_notes,updated_at')
        .single(), null);
    },

    async archiveScenarioResult({ resultId, userId, treatedVersion, treatmentNotes }) {
      const now = new Date().toISOString();
      return unwrap(await client.from('app_test_results')
        .update({
          treated_at: now,
          archived_at: now,
          treated_version: String(treatedVersion || '').trim() || null,
          treatment_notes: String(treatmentNotes || '').trim() || null,
          updated_at: now,
        })
        .eq('id', resultId)
        .eq('user_id', userId)
        .select('id,scenario_id,status,notes,completed_at,treated_at,archived_at,treated_version,treatment_notes,updated_at')
        .single(), null);
    },

    async archiveModuleReview({ reviewId, userId, treatedVersion, treatmentNotes }) {
      const now = new Date().toISOString();
      return unwrap(await client.from('app_test_module_reviews')
        .update({
          treated_at: now,
          archived_at: now,
          treated_version: String(treatedVersion || '').trim() || null,
          treatment_notes: String(treatmentNotes || '').trim() || null,
          updated_at: now,
        })
        .eq('id', reviewId)
        .eq('user_id', userId)
        .select('id,module_id,status,notes,completed_at,treated_at,archived_at,treated_version,treatment_notes,updated_at')
        .single(), null);
    },
  };
}
