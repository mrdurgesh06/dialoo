DROP TABLE IF EXISTS subscription_transactions, invoices, payments, payment_orders, search_logs, favourite_providers,
  customer_addresses, coupon_redemptions, coupons, banners;
ALTER TABLE provider_subscriptions DROP COLUMN cancel_at_period_end, DROP COLUMN updated_at;
