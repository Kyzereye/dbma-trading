-- Forex and crypto symbols (static; run once on install or when pairs change).
--
--   mysql -h localhost -u root -p dbma-trading < sql_queries/forex_and_crypto_symbols.sql

INSERT IGNORE INTO stock_symbols (symbol, company_name, asset_type, exchange, is_active) VALUES
('EURUSD', 'Euro / US Dollar', 'forex', NULL, 1),
('GBPUSD', 'British Pound / US Dollar', 'forex', NULL, 1),
('USDJPY', 'US Dollar / Japanese Yen', 'forex', NULL, 1),
('USDCHF', 'US Dollar / Swiss Franc', 'forex', NULL, 1),
('AUDUSD', 'Australian Dollar / US Dollar', 'forex', NULL, 1),
('USDCAD', 'US Dollar / Canadian Dollar', 'forex', NULL, 1),
('NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', NULL, 1),
('EURGBP', 'Euro / British Pound', 'forex', NULL, 1),
('EURJPY', 'Euro / Japanese Yen', 'forex', NULL, 1),
('EURCHF', 'Euro / Swiss Franc', 'forex', NULL, 1),
('EURAUD', 'Euro / Australian Dollar', 'forex', NULL, 1),
('EURCAD', 'Euro / Canadian Dollar', 'forex', NULL, 1),
('EURNZD', 'Euro / New Zealand Dollar', 'forex', NULL, 1),
('GBPJPY', 'British Pound / Japanese Yen', 'forex', NULL, 1),
('GBPCHF', 'British Pound / Swiss Franc', 'forex', NULL, 1),
('GBPAUD', 'British Pound / Australian Dollar', 'forex', NULL, 1),
('GBPCAD', 'British Pound / Canadian Dollar', 'forex', NULL, 1),
('GBPNZD', 'British Pound / New Zealand Dollar', 'forex', NULL, 1),
('AUDJPY', 'Australian Dollar / Japanese Yen', 'forex', NULL, 1),
('AUDNZD', 'Australian Dollar / New Zealand Dollar', 'forex', NULL, 1),
('AUDCAD', 'Australian Dollar / Canadian Dollar', 'forex', NULL, 1),
('AUDCHF', 'Australian Dollar / Swiss Franc', 'forex', NULL, 1),
('NZDJPY', 'New Zealand Dollar / Japanese Yen', 'forex', NULL, 1),
('NZDCAD', 'New Zealand Dollar / Canadian Dollar', 'forex', NULL, 1),
('NZDCHF', 'New Zealand Dollar / Swiss Franc', 'forex', NULL, 1),
('CADJPY', 'Canadian Dollar / Japanese Yen', 'forex', NULL, 1),
('CADCHF', 'Canadian Dollar / Swiss Franc', 'forex', NULL, 1),
('CHFJPY', 'Swiss Franc / Japanese Yen', 'forex', NULL, 1);

INSERT IGNORE INTO stock_symbols (symbol, company_name, asset_type, exchange, is_active) VALUES
('BTCUSD', 'Bitcoin / US Dollar', 'crypto', NULL, 1),
('ETHUSD', 'Ethereum / US Dollar', 'crypto', NULL, 1),
('SOLUSD', 'Solana / US Dollar', 'crypto', NULL, 1),
('XRPUSD', 'XRP / US Dollar', 'crypto', NULL, 1),
('BNBUSD', 'BNB / US Dollar', 'crypto', NULL, 1),
('DOGEUSD', 'Dogecoin / US Dollar', 'crypto', NULL, 1),
('TRXUSD', 'TRON / US Dollar', 'crypto', NULL, 1);
