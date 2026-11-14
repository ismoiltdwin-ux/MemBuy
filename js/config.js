/* Membuy — настройки. Меняйте только этот файл. */
window.MB = window.MB || {};
MB.config = {
  MODE: 'demo',                 // 'demo' — учебные данные и сделки; 'live' — Phantom + Jupiter + DexScreener
  APP_NAME: 'Membuy',
  PLATFORM_FEE_BPS: 50,         // комиссия площадки: 50 = 0.5%
  FEE_ACCOUNT: '',              // live: ваш токен-аккаунт для комиссии Jupiter (пусто = без комиссии)
  DEFAULT_SLIPPAGE_BPS: 100,    // проскальзывание по умолчанию: 1%
  SOL_USD_DEMO: 150,            // условная цена SOL в демо-режиме
  DEMO_START_SOL: 5,
  RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=d9fb527b-3cbc-4e83-a9fe-9b36fcd56889',
  JUP_API: 'https://lite-api.jup.ag/swap/v1',
  DEX_API: 'https://api.dexscreener.com',
  GECKO_API: 'https://api.geckoterminal.com/api/v2',
  WEB3_CDN: 'https://unpkg.com/@solana/web3.js@1.95.3/lib/index.iife.min.js',
  SOL_MINT: 'So11111111111111111111111111111111111111112',
};

// Проверка живого режима без пересборки: откройте сайт со ссылкой ...?mode=live
try { const m = new URLSearchParams(location.search).get('mode'); if (m === 'live' || m === 'demo') MB.config.MODE = m; } catch (e) { /* нет location */ }
MB.config.LIVE = MB.config.MODE === 'live';
// Разделы, которые работают только с выдуманными данными, в живом режиме скрыты
MB.config.DEMO_ONLY = ['feed', 'leaders', 'create', 'ads', 'invite'];
