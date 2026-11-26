-- V13: Provider fee = Rs 99 per month (the single paid plan). Pro / Business stay in the table but are switched off;
-- an admin can edit price or re-enable plans from Admin > Settings > Provider subscription plans.
UPDATE subscription_plans
   SET name='Dialoo Provider', price=99.00, billing_period='MONTHLY', request_limit=NULL,
       features='Verified listing, priority in search, unlimited booking requests, chat and call, provider dashboard',
       active=TRUE
 WHERE name='Professional';
UPDATE subscription_plans SET active=FALSE WHERE name IN ('Pro','Business');
UPDATE subscription_plans SET features='Free trial listing: basic profile, up to 5 booking requests', request_limit=5 WHERE name='Free';
