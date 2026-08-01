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
          .select('id,campaign_id,module_key,title,description,instructions,sort_order,status')
          .eq('campaign_id', campaign.id)
          .order('sort_order', { ascending: true }),
        client.from('app_test_scenarios')
          .select('id,campaign_id,module_id,title,instructions,expected_result,required,sort_order')
          .eq('campaign_id', campaign.id)
          .order('sort_order', { ascending: true }),
        client.from('app_test_results')
          .select('id,scenario_id,status,notes,completed_at,updated_at')
          .eq('campaign_id', campaign.id)
          .eq('user_id', userId),
        client.from('app_test_module_reviews')
          .select('id,module_id,status,notes,completed_at,updated_at')
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
      const payload = {
        campaign_id: campaignId,
        scenario_id: scenarioId,
        user_id: userId,
        status,
        notes: String(notes || '').trim() || null,
        completed_at: status === 'pending' ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return unwrap(await client
        .from('app_test_results')
        .upsert(payload, { onConflict: 'scenario_id,user_id' })
        .select('id,scenario_id,status,notes,completed_at,updated_at')
        .single(), null);
    },

    async saveModuleReview({ campaignId, moduleId, userId, status, notes }) {
      const payload = {
        campaign_id: campaignId,
        module_id: moduleId,
        user_id: userId,
        status,
        notes: String(notes || '').trim() || null,
        completed_at: status === 'in_progress' ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return unwrap(await client
        .from('app_test_module_reviews')
        .upsert(payload, { onConflict: 'module_id,user_id' })
        .select('id,module_id,status,notes,completed_at,updated_at')
        .single(), null);
    },
  };
}
