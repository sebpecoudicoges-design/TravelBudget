// Personal, synchronized data only. Shared exercise/food libraries are not exposed.
export const MCP_HEALTH_COLUMNS = {
 sport_sessions:'id,user_id,travel_id,activity_type,started_at,ended_at,duration_seconds,mood_before,mood_after,energy,fatigue,pain,body_weight_kg,notes,estimated_kcal',
 sport_session_items:'id,user_id,session_id,activity_key,exercise_key,exercise_name,equipment,mode,target_reps,target_seconds,distance_m,planned_sets,rest_seconds,sort_order,notes',
 sport_sets:'id,user_id,item_id,set_index,reps,duration_seconds,weight_kg,distance_m,completed_at,perceived_effort,notes',
 sport_programs:'id,user_id,key,name,goal,cycle,start_date,is_active,notes',
 sport_program_sessions:'id,user_id,program_id,session_key,name,week_label,day_of_week,sort_order,notes',
 sport_program_exercises:'id,user_id,session_id,exercise_key,exercise_name,mode,target_reps,target_seconds,planned_sets,rest_seconds,default_weight_kg,distance_m,sort_order,notes',
 sport_exercise_metrics:'id,user_id,exercise_id,latest_weight_kg,latest_reps,latest_e1rm_kg,best_all_time_e1rm_kg,training_max_kg,recommended_weight_kg,recommendation_reason,calculated_at',
 nutrition_meals:'id,user_id,travel_id,meal_date,meal_type,label,notes,water_ml,consumed_time',
 nutrition_meal_items:'id,user_id,meal_id,food_key,label,grams,kcal,protein_g,carbs_g,fat_g,fiber_g,sort_order',
 nutrition_sleep:'id,user_id,sleep_date,hours,quality,notes',
 nutrition_recipes:'id,user_id,name,description,default_servings,is_archived',
 nutrition_recipe_ingredients:'id,user_id,recipe_id,food_key,label,quantity,unit,quantity_grams,initial_state,cooking_method_code,sort_order,notes',
 nutrition_recipe_batches:'id,user_id,recipe_id,cooked_at,name,final_weight_g,final_weight_source,servings,precision_level,total_kcal,total_protein_g,total_carbs_g,total_fat_g,total_fiber_g,notes',
 nutrition_recipe_batch_consumptions:'id,user_id,batch_id,meal_id,consumed_at,consumed_weight_g,nutrition_snapshot',
};
export const healthDatasets=domain=>Object.keys(MCP_HEALTH_COLUMNS).filter(table=>table.startsWith(domain+'_')).map(table=>table.slice(domain.length+1));
