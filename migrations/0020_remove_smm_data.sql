-- Remove the retired SMM storefront data model. User accounts, profile settings, brand assets,
-- rate limits and Telegram X Hero messaging tables remain.
DROP TABLE IF EXISTS broadcast_history;
DROP TABLE IF EXISTS broadcast_drafts;
DROP TABLE IF EXISTS payment_methods;
DROP TABLE IF EXISTS currencies;
DROP TABLE IF EXISTS category_icons;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS ledger;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS price_changes;
DROP TABLE IF EXISTS category_rules;
DROP TABLE IF EXISTS category_summary;
DROP TABLE IF EXISTS service_names;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS referrals;
DROP TABLE IF EXISTS webhook_events;
