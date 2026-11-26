UPDATE subscription_plans SET name='Professional', features='Improved search ranking, more requests', request_limit=50 WHERE name='Dialoo Provider';
UPDATE subscription_plans SET active=TRUE WHERE name IN ('Pro','Business');
