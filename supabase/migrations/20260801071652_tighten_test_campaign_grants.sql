-- Default project privileges grant broad table capabilities. Keep the browser API least-privileged.
revoke all on public.app_test_campaigns, public.app_test_modules, public.app_test_scenarios, public.app_test_results, public.app_test_module_reviews from authenticated;

grant select on public.app_test_campaigns, public.app_test_modules, public.app_test_scenarios to authenticated;
grant select, insert, update on public.app_test_results, public.app_test_module_reviews to authenticated;

grant all on public.app_test_campaigns, public.app_test_modules, public.app_test_scenarios, public.app_test_results, public.app_test_module_reviews to service_role;
