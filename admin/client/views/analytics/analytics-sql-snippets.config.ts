export const SQL_SNIPPETS: Record<string, string> = {
  '2fa-adoption': `SELECT 
  CASE WHEN two_factor_secret IS NOT NULL THEN '2FA Habilitado' ELSE 'Solo Contraseña' END AS auth_type,
  COUNT(*) AS total_usuarios,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM db_identity.users), 2) AS porcentaje
FROM db_identity.users
GROUP BY auth_type;`,
  'ai-satisfaction': `SELECT 
  sentiment,
  COUNT(*) AS total_feedbacks,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM db_identity.ai_chat_feedback), 2) AS porcentaje
FROM db_identity.ai_chat_feedback
GROUP BY sentiment;`,
  'canvases-storage': `SELECT 
  id,
  uuid,
  name,
  user_id,
  access_level,
  ROUND(size_bytes / 1024, 2) AS size_kb,
  views_count,
  created_at
FROM db_canvas.canvases
ORDER BY size_bytes DESC
LIMIT 25;`,
  'revenue-plans': `SELECT 
  plan_id,
  billing_period,
  currency,
  COUNT(*) AS total_compras,
  SUM(amount) AS total_facturado,
  AVG(amount) AS ticket_promedio
FROM db_identity.purchases
WHERE status = 'completed'
GROUP BY plan_id, billing_period, currency
ORDER BY total_facturado DESC;`,
  'top-users': `SELECT 
  u.id,
  u.username,
  u.email,
  u.subscription_tier,
  p.theme,
  p.language,
  u.created_at
FROM db_identity.users u
LEFT JOIN db_identity.user_preferences p ON p.user_id = u.id
ORDER BY u.id DESC
LIMIT 25;`,
};
