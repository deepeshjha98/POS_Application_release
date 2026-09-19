var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/main.ts
var main_exports = {};
module.exports = __toCommonJS(main_exports);
var import_electron = require("electron");
var import_node_child_process = require("node:child_process");
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// src/data/sqlite.ts
var import_node_sqlite = require("node:sqlite");
var Statement = class {
  constructor(inner) {
    this.inner = inner;
  }
  run(...params) {
    return this.inner.run(...params);
  }
  get(...params) {
    return this.inner.get(...params);
  }
  all(...params) {
    return this.inner.all(...params);
  }
};
var Database = class {
  constructor(inner) {
    this.inner = inner;
  }
  /** कितनी गहराई तक लेन-देन चल रहा है — अंदर वाले SAVEPOINT से चलते हैं. */
  depth = 0;
  prepare(sql) {
    return new Statement(this.inner.prepare(sql));
  }
  exec(sql) {
    this.inner.exec(sql);
  }
  pragma(statement) {
    if (statement.includes("=")) {
      this.inner.exec(`PRAGMA ${statement}`);
      return [];
    }
    return this.inner.prepare(`PRAGMA ${statement}`).all();
  }
  /**
   * लेन-देन. बीच में कोई गलती हुई तो सब कुछ वापस पुरानी हालत में.
   *
   * अंदर एक और लेन-देन शुरू हो जाए (जैसे एक repo दूसरे को बुलाए), तो
   * SQLite का SAVEPOINT इस्तेमाल होता है — वरना अंदर वाला COMMIT बाहर
   * वाले को भी पक्का कर देता, और आधा काम सहेजा जा सकता था.
   */
  transaction(work) {
    return () => {
      const isOuter = this.depth === 0;
      const savepoint = `sp_${this.depth}`;
      this.inner.exec(isOuter ? "BEGIN" : `SAVEPOINT ${savepoint}`);
      this.depth += 1;
      try {
        const result = work();
        this.depth -= 1;
        this.inner.exec(isOuter ? "COMMIT" : `RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        this.depth -= 1;
        try {
          this.inner.exec(isOuter ? "ROLLBACK" : `ROLLBACK TO ${savepoint}`);
          if (!isOuter) this.inner.exec(`RELEASE ${savepoint}`);
        } catch {
        }
        throw error;
      }
    };
  }
  close() {
    this.inner.close();
  }
};
function openSqlite(file) {
  return new Database(new import_node_sqlite.DatabaseSync(file));
}

// src/data/schema.ts
var SCHEMA_SQL = `
-- ============================================================================
-- POS \u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u2014 \u092E\u0949\u0921\u094D\u092F\u0942\u0932 1: \u0938\u093E\u092E\u093E\u0928 (product)
--
-- \u092C\u0941\u0928\u093F\u092F\u093E\u0926\u0940 \u0928\u093F\u092F\u092E:
--  * \u092A\u0948\u0938\u093E \u0939\u092E\u0947\u0936\u093E INTEGER \u092A\u0948\u0938\u0947 \u092E\u0947\u0902. \u0915\u094B\u0908 REAL/FLOAT \u0915\u0949\u0932\u092E \u0928\u0939\u0940\u0902 \u2014 \u0915\u0939\u0940\u0902 \u092D\u0940 \u0928\u0939\u0940\u0902.
--  * \u092E\u093E\u0924\u094D\u0930\u093E \u0939\u092E\u0947\u0936\u093E INTEGER ticks \u092E\u0947\u0902 (1 \u0906\u0927\u093E\u0930-\u0907\u0915\u093E\u0908 = 1000 ticks).
--  * \u0915\u0941\u091B \u092D\u0940 \u092E\u093F\u091F\u093E\u092F\u093E \u0928\u0939\u0940\u0902 \u091C\u093E\u0924\u093E. \u0939\u091F\u093E\u0928\u093E = is_active \u0915\u094B 0 \u0915\u0930\u0928\u093E.
--  * \u0939\u0930 \u092C\u0926\u0932\u093E\u0935 audit_log \u092E\u0947\u0902 \u0926\u0930\u094D\u091C \u0939\u094B\u0924\u093E \u0939\u0948.
--  * \u091C\u094B \u0928\u093F\u092F\u092E code \u092E\u0947\u0902 \u0939\u0948\u0902, \u0935\u0939\u0940 CHECK \u092C\u0928 \u0915\u0930 \u092F\u0939\u093E\u0901 \u092D\u0940 \u0939\u0948\u0902 \u2014 \u0926\u094B \u0924\u093E\u0932\u094B\u0902 \u0935\u093E\u0932\u0940 \u0938\u0941\u0930\u0915\u094D\u0937\u093E.
-- ============================================================================

-- \u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u0915\u093F\u0938 \u0930\u0942\u092A \u092E\u0947\u0902 \u0939\u0948. \u0939\u0930 \u092C\u0926\u0932\u093E\u0935 \u092A\u0930 \u092C\u0922\u093C\u0924\u093E \u0939\u0948, \u0924\u093E\u0915\u093F \u092A\u0941\u0930\u093E\u0928\u093E \u0921\u0947\u091F\u093E\u092C\u0947\u0938
-- \u0905\u092A\u0928\u0947 \u0906\u092A \u0928\u090F \u0930\u0942\u092A \u092E\u0947\u0902 \u0922\u0932 \u091C\u093E\u090F \u0914\u0930 \u0915\u0941\u091B \u0916\u094B\u090F \u0928\u0939\u0940\u0902.
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

-- \u0938\u093E\u092E\u093E\u0928 \u0915\u0940 \u0936\u094D\u0930\u0947\u0923\u0940 (\u0926\u093E\u0932-\u091A\u093E\u0935\u0932, \u0938\u093E\u092C\u0941\u0928-\u0936\u0948\u092E\u094D\u092A\u0942, ...)
CREATE TABLE IF NOT EXISTS category (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_category_name
  ON category (name) WHERE is_active = 1;

-- \u0938\u093E\u092E\u093E\u0928
CREATE TABLE IF NOT EXISTS product (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL CHECK (length(trim(name)) > 0),
  alt_name            TEXT,
  -- \u0916\u094B\u091C\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0924\u0948\u092F\u093E\u0930 \u0930\u0942\u092A (\u091B\u094B\u091F\u0947 \u0905\u0915\u094D\u0937\u0930, \u0926\u094B\u0928\u094B\u0902 \u0928\u093E\u092E \u092E\u093F\u0932\u0947 \u0939\u0941\u090F)
  search_key          TEXT NOT NULL,

  kind                TEXT NOT NULL CHECK (kind IN ('PACKED', 'LOOSE', 'SERVICE')),
  measure             TEXT NOT NULL CHECK (measure IN ('COUNT', 'WEIGHT', 'VOLUME', 'LENGTH')),
  sale_unit           TEXT NOT NULL,

  -- ---- \u092A\u0948\u0938\u093E: \u0938\u092C \u0915\u0941\u091B \u092A\u0942\u0930\u094D\u0923\u093E\u0902\u0915 \u092A\u0948\u0938\u0947 \u092E\u0947\u0902 ----
  sale_price          INTEGER NOT NULL CHECK (sale_price > 0),
  mrp                 INTEGER CHECK (mrp IS NULL OR mrp > 0),
  purchase_price      INTEGER CHECK (purchase_price IS NULL OR purchase_price >= 0),
  price_includes_gst  INTEGER NOT NULL CHECK (price_includes_gst IN (0, 1)),
  gst_rate_bps        INTEGER NOT NULL CHECK (gst_rate_bps >= 0 AND gst_rate_bps <= 10000),
  hsn_code            TEXT CHECK (hsn_code IS NULL OR length(hsn_code) IN (4, 6, 8)),

  -- \u0939\u0930 \u0938\u093E\u092E\u093E\u0928 \u0915\u0940 \u090F\u0915 \u0936\u094D\u0930\u0947\u0923\u0940 \u091C\u093C\u0930\u0942\u0930\u0940 \u0939\u0948. \u092C\u093F\u0932\u093F\u0902\u0917 \u0936\u094D\u0930\u0947\u0923\u0940 \u0938\u0947 \u091A\u0932\u0924\u0940 \u0939\u0948, \u0907\u0938\u0932\u093F\u090F
  -- \u092C\u093F\u0928\u093E \u0936\u094D\u0930\u0947\u0923\u0940 \u0915\u093E \u0938\u093E\u092E\u093E\u0928 \u0915\u0939\u0940\u0902 \u0926\u093F\u0916\u0947\u0917\u093E \u0939\u0940 \u0928\u0939\u0940\u0902 \u2014 \u0935\u094B \u091A\u0941\u092A\u091A\u093E\u092A \u0916\u094B \u091C\u093E\u0928\u093E \u0939\u094B\u0917\u093E.
  category_id         TEXT NOT NULL REFERENCES category (id),

  -- "\u0938\u092C\u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u092C\u093F\u0915\u0928\u0947 \u0935\u093E\u0932\u093E" \u0916\u093F\u0921\u093C\u0915\u0940 \u092E\u0947\u0902 \u092D\u0940 \u0926\u093F\u0916\u0947. \u0938\u093E\u092E\u093E\u0928 \u0905\u092A\u0928\u0940 \u0936\u094D\u0930\u0947\u0923\u0940 \u092E\u0947\u0902
  -- \u0924\u094B \u0930\u0939\u0924\u093E \u0939\u0940 \u0939\u0948 \u2014 \u092F\u0947 \u0909\u0938\u0915\u0947 \u0905\u0932\u093E\u0935\u093E \u0939\u0948, \u0909\u0938\u0915\u0940 \u091C\u0917\u0939 \u0928\u0939\u0940\u0902.
  in_super            INTEGER NOT NULL DEFAULT 0 CHECK (in_super IN (0, 1)),

  -- ---- \u0938\u094D\u091F\u0949\u0915: \u0938\u092C \u0915\u0941\u091B \u092A\u0942\u0930\u094D\u0923\u093E\u0902\u0915 ticks \u092E\u0947\u0902 ----
  track_stock         INTEGER NOT NULL CHECK (track_stock IN (0, 1)),
  low_stock_at        INTEGER CHECK (low_stock_at IS NULL OR low_stock_at > 0),
  min_sale_qty        INTEGER CHECK (min_sale_qty IS NULL OR min_sale_qty > 0),
  qty_step            INTEGER CHECK (qty_step IS NULL OR qty_step > 0),

  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,

  -- MRP \u0938\u0947 \u090A\u092A\u0930 \u092C\u0947\u091A\u0928\u093E \u092D\u093E\u0930\u0924 \u092E\u0947\u0902 \u0915\u093C\u093E\u0928\u0942\u0928\u0928 \u092E\u0928\u093E \u0939\u0948. code \u092E\u0947\u0902 \u092D\u0940 \u0930\u094B\u0915\u093E \u0939\u0948, \u092F\u0939\u093E\u0901 \u092D\u0940.
  CHECK (mrp IS NULL OR sale_price <= mrp),
  -- \u092C\u093F\u0928\u093E \u0938\u094D\u091F\u0949\u0915 \u0935\u093E\u0932\u0947 \u0938\u093E\u092E\u093E\u0928 \u0915\u093E \u0938\u094D\u091F\u0949\u0915 \u0928\u0939\u0940\u0902 \u0917\u093F\u0928\u093E \u091C\u093E \u0938\u0915\u0924\u093E
  CHECK (NOT (kind = 'SERVICE' AND track_stock = 1)),
  -- \u0915\u092E \u0938\u0947 \u0915\u092E \u092E\u093E\u0924\u094D\u0930\u093E, \u0917\u0941\u0923\u0915 \u092E\u0947\u0902 \u092A\u0942\u0930\u0940 \u092C\u0948\u0920\u0928\u0940 \u091A\u093E\u0939\u093F\u090F
  CHECK (min_sale_qty IS NULL OR qty_step IS NULL OR min_sale_qty % qty_step = 0)
);

CREATE INDEX IF NOT EXISTS ix_product_search    ON product (search_key);
CREATE INDEX IF NOT EXISTS ix_product_active    ON product (is_active, name);
CREATE INDEX IF NOT EXISTS ix_product_category  ON product (category_id, name);
CREATE INDEX IF NOT EXISTS ix_product_super     ON product (in_super, name) WHERE in_super = 1;

-- \u092C\u093E\u0930\u0915\u094B\u0921 \u2014 \u090F\u0915 \u0938\u093E\u092E\u093E\u0928 \u0915\u0947 \u0915\u0908 \u0939\u094B \u0938\u0915\u0924\u0947 \u0939\u0948\u0902, \u092A\u0930 \u090F\u0915 \u092C\u093E\u0930\u0915\u094B\u0921 \u0938\u093F\u0930\u094D\u092B\u093C \u090F\u0915 \u0938\u093E\u092E\u093E\u0928 \u0915\u093E.
-- barcode \u0915\u093E PRIMARY KEY \u0939\u094B\u0928\u093E \u0939\u0940 \u0935\u094B \u0924\u093E\u0932\u093E \u0939\u0948 \u091C\u094B \u0926\u094B \u0938\u093E\u092E\u093E\u0928 \u092A\u0930 \u090F\u0915 \u092C\u093E\u0930\u0915\u094B\u0921 \u0928\u0939\u0940\u0902 \u0932\u0917\u0928\u0947 \u0926\u0947\u0924\u093E.
CREATE TABLE IF NOT EXISTS product_barcode (
  barcode     TEXT PRIMARY KEY CHECK (length(barcode) BETWEEN 4 AND 20),
  product_id  TEXT NOT NULL REFERENCES product (id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_product_barcode_product ON product_barcode (product_id);

-- \u0939\u0930 \u092C\u0926\u0932\u093E\u0935 \u0915\u093E \u092C\u094D\u092F\u094B\u0930\u093E. \u0915\u092D\u0940 \u092E\u093F\u091F\u093E\u092F\u093E \u0928\u0939\u0940\u0902 \u091C\u093E\u0924\u093E.
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE')),
  before_json TEXT,
  after_json  TEXT,
  actor       TEXT
);

CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log (entity, entity_id, id);
CREATE INDEX IF NOT EXISTS ix_audit_at     ON audit_log (at);
`;

// src/data/db.ts
var SCHEMA_VERSION = 2;
var UPGRADES = {
  /**
   * 1 -> 2 : श्रेणी ज़रूरी हुई, और "सुपर" का निशान जुड़ा.
   *
   * पुराने सामान की कोई श्रेणी नहीं थी. उन्हें चुपचाप मिटाना गलत होगा,
   * इसलिए एक श्रेणी "बाक़ी सामान" बना कर उसमें डाल देते हैं — दुकानदार
   * बाद में आराम से ठीक कर सकता है.
   */
  1: (db2) => {
    const columns = db2.prepare("PRAGMA table_info(product)").all();
    if (!columns.some((c) => c.name === "in_super")) {
      db2.exec(
        "ALTER TABLE product ADD COLUMN in_super INTEGER NOT NULL DEFAULT 0 CHECK (in_super IN (0, 1))"
      );
    }
    const orphans = db2.prepare("SELECT COUNT(*) AS n FROM product WHERE category_id IS NULL").get();
    if (orphans.n > 0) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const fallbackId = "category-baqi-samaan";
      db2.prepare(
        `INSERT OR IGNORE INTO category (id, name, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`
      ).run(fallbackId, "\u092C\u093E\u0915\u093C\u0940 \u0938\u093E\u092E\u093E\u0928", 9999, now, now);
      db2.prepare("UPDATE product SET category_id = ? WHERE category_id IS NULL").run(fallbackId);
    }
    db2.exec(`
      CREATE TABLE product_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        alt_name TEXT,
        search_key TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('PACKED', 'LOOSE', 'SERVICE')),
        measure TEXT NOT NULL CHECK (measure IN ('COUNT', 'WEIGHT', 'VOLUME', 'LENGTH')),
        sale_unit TEXT NOT NULL,
        sale_price INTEGER NOT NULL CHECK (sale_price > 0),
        mrp INTEGER CHECK (mrp IS NULL OR mrp > 0),
        purchase_price INTEGER CHECK (purchase_price IS NULL OR purchase_price >= 0),
        price_includes_gst INTEGER NOT NULL CHECK (price_includes_gst IN (0, 1)),
        gst_rate_bps INTEGER NOT NULL CHECK (gst_rate_bps >= 0 AND gst_rate_bps <= 10000),
        hsn_code TEXT CHECK (hsn_code IS NULL OR length(hsn_code) IN (4, 6, 8)),
        category_id TEXT NOT NULL REFERENCES category (id),
        in_super INTEGER NOT NULL DEFAULT 0 CHECK (in_super IN (0, 1)),
        track_stock INTEGER NOT NULL CHECK (track_stock IN (0, 1)),
        low_stock_at INTEGER CHECK (low_stock_at IS NULL OR low_stock_at > 0),
        min_sale_qty INTEGER CHECK (min_sale_qty IS NULL OR min_sale_qty > 0),
        qty_step INTEGER CHECK (qty_step IS NULL OR qty_step > 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (mrp IS NULL OR sale_price <= mrp),
        CHECK (NOT (kind = 'SERVICE' AND track_stock = 1)),
        CHECK (min_sale_qty IS NULL OR qty_step IS NULL OR min_sale_qty % qty_step = 0)
      );

      INSERT INTO product_new SELECT
        id, name, alt_name, search_key, kind, measure, sale_unit,
        sale_price, mrp, purchase_price, price_includes_gst, gst_rate_bps, hsn_code,
        category_id, in_super, track_stock, low_stock_at, min_sale_qty, qty_step,
        is_active, created_at, updated_at
      FROM product;

      DROP TABLE product;
      ALTER TABLE product_new RENAME TO product;

      CREATE INDEX IF NOT EXISTS ix_product_search    ON product (search_key);
      CREATE INDEX IF NOT EXISTS ix_product_active    ON product (is_active, name);
      CREATE INDEX IF NOT EXISTS ix_product_category  ON product (category_id, name);
      CREATE INDEX IF NOT EXISTS ix_product_super     ON product (in_super, name) WHERE in_super = 1;
    `);
  }
};
function readCurrentVersion(db2) {
  db2.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db2.prepare("SELECT version FROM schema_version LIMIT 1").get();
  if (row) return row.version;
  const hasProduct = db2.prepare("SELECT 1 AS hit FROM sqlite_master WHERE type = 'table' AND name = 'product'").get();
  const version = hasProduct ? 1 : 0;
  db2.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
  return version;
}
function migrate(db2) {
  const schema = SCHEMA_SQL;
  db2.pragma("foreign_keys = OFF");
  const from = readCurrentVersion(db2);
  const run = db2.transaction(() => {
    if (from === 0) {
      db2.exec(schema);
    } else {
      for (let version = from; version < SCHEMA_VERSION; version += 1) {
        const upgrade = UPGRADES[version];
        if (!upgrade) {
          throw new Error(`\u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u0915\u094B ${version} \u0938\u0947 \u0906\u0917\u0947 \u091A\u0922\u093C\u093E\u0928\u0947 \u0915\u093E \u0930\u093E\u0938\u094D\u0924\u093E \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E`);
        }
        upgrade(db2);
      }
      db2.exec(schema);
    }
    db2.prepare("UPDATE schema_version SET version = ?").run(SCHEMA_VERSION);
  });
  run();
  const broken = db2.pragma("foreign_key_check");
  db2.pragma("foreign_keys = ON");
  if (broken.length > 0) {
    throw new Error(`\u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u092E\u0947\u0902 ${broken.length} \u091C\u0917\u0939 \u091C\u0941\u0921\u093C\u093E\u0935 \u091F\u0942\u091F\u093E \u0939\u0941\u0906 \u092E\u093F\u0932\u093E`);
  }
  return { from, to: SCHEMA_VERSION };
}
function openDatabase(file) {
  const db2 = openSqlite(file);
  db2.pragma("journal_mode = WAL");
  db2.pragma("synchronous = FULL");
  db2.pragma("busy_timeout = 5000");
  migrate(db2);
  return db2;
}

// src/core/ids.ts
var ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
function randomChars(count) {
  const bytes = new Uint8Array(count);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < count; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
function newId(now = Date.now()) {
  return now.toString(36).padStart(10, "0") + randomChars(12);
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}

// src/core/money.ts
var PAISE_PER_RUPEE = 100;
var MoneyError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "MoneyError";
  }
};
var MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
var MIN_SAFE = -MAX_SAFE;
function requireInteger(value, label) {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`${label} \u0938\u0939\u0940 \u0938\u0902\u0916\u094D\u092F\u093E \u0928\u0939\u0940\u0902 \u0939\u0948: ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} \u092A\u0942\u0930\u094D\u0923\u093E\u0902\u0915 \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F (\u092A\u0948\u0938\u0947 \u092E\u0947\u0902), \u092E\u093F\u0932\u093E: ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0938\u0940\u092E\u093E \u0938\u0947 \u092C\u093E\u0939\u0930 \u0939\u0948: ${value}`);
  }
}
function toPaise(value) {
  requireInteger(value, "\u0930\u0915\u093C\u092E");
  return value;
}
function formatPaise(amount, withSymbol = true) {
  requireInteger(amount, "\u0930\u0915\u093C\u092E");
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const rupeePart = Math.trunc(abs / PAISE_PER_RUPEE);
  const paisePart = abs % PAISE_PER_RUPEE;
  const grouped = new Intl.NumberFormat("en-IN", {
    useGrouping: true,
    maximumFractionDigits: 0
  }).format(rupeePart);
  const symbol = withSymbol ? "\u20B9" : "";
  return `${sign}${symbol}${grouped}.${String(paisePart).padStart(2, "0")}`;
}

// src/core/gst.ts
var GstError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "GstError";
  }
};
var GST_SLABS = Object.freeze([
  { bps: 0, label: "0%", active: true, commonInKirana: true, note: "\u0916\u0941\u0932\u093E/\u092C\u093F\u0928\u093E \u092C\u094D\u0930\u093E\u0902\u0921 \u0915\u093E \u0905\u0928\u093E\u091C, \u0926\u093E\u0932, \u0906\u091F\u093E, \u0924\u093E\u091C\u093C\u093E \u0938\u093E\u092E\u093E\u0928, \u0926\u0942\u0927" },
  { bps: 25, label: "0.25%", active: true, commonInKirana: false, note: "\u092C\u093F\u0928\u093E \u0924\u0930\u093E\u0936\u0947 \u0939\u0940\u0930\u0947" },
  { bps: 300, label: "3%", active: true, commonInKirana: false, note: "\u0938\u094B\u0928\u093E, \u091A\u093E\u0901\u0926\u0940, \u0917\u0939\u0928\u0947" },
  { bps: 500, label: "5%", active: true, commonInKirana: true, note: "\u091C\u093C\u094D\u092F\u093E\u0926\u093E\u0924\u0930 \u092A\u0948\u0915\u0947\u091F \u0935\u093E\u0932\u093E \u0916\u093E\u0928\u0947 \u0915\u093E \u0938\u093E\u092E\u093E\u0928, \u0930\u094B\u091C\u093C\u092E\u0930\u094D\u0930\u093E \u0915\u0940 \u091A\u0940\u091C\u093C\u0947\u0902" },
  { bps: 1200, label: "12% (\u092A\u0941\u0930\u093E\u0928\u093E)", active: false, commonInKirana: false, note: "22 \u0938\u093F\u0924\u0902\u092C\u0930 2025 \u0938\u0947 \u0939\u091F\u093E \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u2014 \u0938\u093F\u0930\u094D\u092B\u093C \u092A\u0941\u0930\u093E\u0928\u0947 \u092C\u093F\u0932\u094B\u0902 \u0915\u0947 \u0932\u093F\u090F" },
  { bps: 1800, label: "18%", active: true, commonInKirana: true, note: "\u092C\u093E\u0915\u093C\u0940 \u091C\u093C\u094D\u092F\u093E\u0926\u093E\u0924\u0930 \u0938\u093E\u092E\u093E\u0928" },
  { bps: 2800, label: "28% (\u092A\u0941\u0930\u093E\u0928\u093E)", active: false, commonInKirana: false, note: "22 \u0938\u093F\u0924\u0902\u092C\u0930 2025 \u0938\u0947 \u0939\u091F\u093E \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u2014 \u0938\u093F\u0930\u094D\u092B\u093C \u092A\u0941\u0930\u093E\u0928\u0947 \u092C\u093F\u0932\u094B\u0902 \u0915\u0947 \u0932\u093F\u090F" },
  { bps: 4e3, label: "40%", active: true, commonInKirana: false, note: "\u0924\u0902\u092C\u093E\u0915\u0942, \u092A\u093E\u0928 \u092E\u0938\u093E\u0932\u093E, \u0920\u0902\u0921\u0947 \u092E\u0940\u0920\u0947 \u092A\u0947\u092F" }
]);
var SLABS_BY_BPS = new Map(GST_SLABS.map((s) => [s.bps, s]));
function isKnownGstRate(bps) {
  return SLABS_BY_BPS.has(bps);
}
function toGstRate(bps) {
  if (!Number.isInteger(bps)) {
    throw new GstError(`GST \u0926\u0930 \u092A\u0942\u0930\u094D\u0923\u093E\u0902\u0915 basis points \u092E\u0947\u0902 \u0939\u094B\u0928\u0940 \u091A\u093E\u0939\u093F\u090F, \u092E\u093F\u0932\u093E: ${bps}`);
  }
  if (bps < 0 || bps > 1e4) {
    throw new GstError(`GST \u0926\u0930 0% \u0938\u0947 100% \u0915\u0947 \u092C\u0940\u091A \u0939\u094B\u0928\u0940 \u091A\u093E\u0939\u093F\u090F, \u092E\u093F\u0932\u093E: ${bps / 100}%`);
  }
  return bps;
}
function isValidHsn(code) {
  if (typeof code !== "string") return false;
  const trimmed = code.trim();
  return /^\d{4}$/.test(trimmed) || /^\d{6}$/.test(trimmed) || /^\d{8}$/.test(trimmed);
}

// src/core/units.ts
var TICKS_PER_BASE = 1e3;
var UnitError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "UnitError";
  }
};
var B = TICKS_PER_BASE;
var UNIT_LIST = Object.freeze([
  // गिनती — आधार: पीस
  { code: "PCS", measure: "COUNT", labelHi: "\u092A\u0940\u0938", labelEn: "Piece", ticks: B, decimals: 0, isBase: true },
  { code: "DOZ", measure: "COUNT", labelHi: "\u0926\u0930\u094D\u091C\u0928", labelEn: "Dozen", ticks: B * 12, decimals: 0, isBase: false },
  // तौल — आधार: ग्राम
  { code: "G", measure: "WEIGHT", labelHi: "\u0917\u094D\u0930\u093E\u092E", labelEn: "Gram", ticks: B, decimals: 0, isBase: true },
  { code: "KG", measure: "WEIGHT", labelHi: "\u0915\u093F\u0932\u094B", labelEn: "Kilogram", ticks: B * 1e3, decimals: 3, isBase: false },
  { code: "QTL", measure: "WEIGHT", labelHi: "\u0915\u094D\u0935\u093F\u0902\u091F\u0932", labelEn: "Quintal", ticks: B * 1e5, decimals: 3, isBase: false },
  // नाप — आधार: मिलीलीटर
  { code: "ML", measure: "VOLUME", labelHi: "\u092E\u093F.\u0932\u0940.", labelEn: "Millilitre", ticks: B, decimals: 0, isBase: true },
  { code: "L", measure: "VOLUME", labelHi: "\u0932\u0940\u091F\u0930", labelEn: "Litre", ticks: B * 1e3, decimals: 3, isBase: false },
  // लंबाई — आधार: मीटर
  { code: "M", measure: "LENGTH", labelHi: "\u092E\u0940\u091F\u0930", labelEn: "Metre", ticks: B, decimals: 2, isBase: true },
  { code: "CM", measure: "LENGTH", labelHi: "\u0938\u0947.\u092E\u0940.", labelEn: "Centimetre", ticks: B / 100, decimals: 0, isBase: false }
]);
var UNITS_BY_CODE = new Map(
  UNIT_LIST.map((u) => [u.code, u])
);
function getUnit(code) {
  const unit = UNITS_BY_CODE.get(code);
  if (!unit) {
    throw new UnitError(`\u0905\u0928\u091C\u093E\u0928 \u0907\u0915\u093E\u0908: ${String(code)}`);
  }
  return unit;
}
function isUnitCode(value) {
  return typeof value === "string" && UNITS_BY_CODE.has(value);
}
function unitsForMeasure(measure) {
  return UNIT_LIST.filter((u) => u.measure === measure);
}
function baseUnitOf(measure) {
  const base = UNIT_LIST.find((u) => u.measure === measure && u.isBase);
  if (!base) {
    throw new UnitError(`${measure} \u0915\u0940 \u0915\u094B\u0908 \u0906\u0927\u093E\u0930-\u0907\u0915\u093E\u0908 \u0924\u092F \u0928\u0939\u0940\u0902 \u0939\u0948`);
  }
  return base;
}
function requireTicks(value, label = "\u092E\u093E\u0924\u094D\u0930\u093E") {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new UnitError(`${label} \u092A\u0942\u0930\u094D\u0923\u093E\u0902\u0915 ticks \u092E\u0947\u0902 \u0939\u094B\u0928\u0940 \u091A\u093E\u0939\u093F\u090F, \u092E\u093F\u0932\u093E: ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new UnitError(`${label} \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0938\u0940\u092E\u093E \u0938\u0947 \u092C\u093E\u0939\u0930 \u0939\u0948: ${value}`);
  }
}
function toTicks(value) {
  requireTicks(value);
  return value;
}
function formatQuantity(ticks, code) {
  requireTicks(ticks);
  const unit = getUnit(code);
  const sign = ticks < 0 ? "-" : "";
  const abs = Math.abs(ticks);
  const whole = Math.trunc(abs / unit.ticks);
  const remainder = abs - whole * unit.ticks;
  if (remainder === 0) {
    return `${sign}${whole}`;
  }
  let rest = remainder;
  let fraction = "";
  const MAX_DIGITS = 12;
  while (rest !== 0 && fraction.length < MAX_DIGITS) {
    rest *= 10;
    const digit = Math.trunc(rest / unit.ticks);
    fraction += String(digit);
    rest -= digit * unit.ticks;
  }
  return `${sign}${whole}.${fraction}`;
}
function formatQuantityWithUnit(ticks, code) {
  return `${formatQuantity(ticks, code)} ${getUnit(code).labelHi}`;
}
function fitsInUnit(ticks, code) {
  requireTicks(ticks);
  const unit = getUnit(code);
  const perFracDigit = unit.ticks / 10 ** unit.decimals;
  return Math.abs(ticks) % perFracDigit === 0;
}
function formatQuantitySmart(ticks, measure) {
  requireTicks(ticks);
  const abs = Math.abs(ticks);
  const base = baseUnitOf(measure);
  if (abs === 0) {
    return formatQuantityWithUnit(ticks, base.code);
  }
  const candidates = unitsForMeasure(measure).slice().sort((a, b) => b.ticks - a.ticks);
  for (const unit of candidates) {
    if (abs >= unit.ticks && fitsInUnit(ticks, unit.code)) {
      return formatQuantityWithUnit(ticks, unit.code);
    }
  }
  return formatQuantityWithUnit(ticks, base.code);
}

// src/domain/conflicts.ts
function checkProductConflicts(clean, lookup, options = {}) {
  const issues = [];
  for (const barcode of clean.barcodes ?? []) {
    const owner = lookup.barcodeOwnerName(barcode);
    if (owner !== null) {
      issues.push({
        field: "barcodes",
        level: "error",
        message: `\u092C\u093E\u0930\u0915\u094B\u0921 "${barcode}" \u092A\u0939\u0932\u0947 \u0938\u0947 "${owner}" \u092A\u0930 \u0932\u0917\u093E \u0939\u0948 \u2014 \u090F\u0915 \u092C\u093E\u0930\u0915\u094B\u0921 \u0938\u093F\u0930\u094D\u092B\u093C \u090F\u0915 \u0938\u093E\u092E\u093E\u0928 \u092A\u0930 \u0932\u0917 \u0938\u0915\u0924\u093E \u0939\u0948`
      });
    }
  }
  if (!options.allowDuplicateName && lookup.hasSameActiveName(clean.name)) {
    issues.push({
      field: "name",
      level: "error",
      message: `"${clean.name}" \u0928\u093E\u092E \u0915\u093E \u0938\u093E\u092E\u093E\u0928 \u092A\u0939\u0932\u0947 \u0938\u0947 \u0939\u0948 \u2014 \u092A\u0915\u094D\u0915\u093E \u0915\u0930\u0947\u0902 \u0915\u093F \u092F\u0947 \u0905\u0932\u0917 \u091A\u0940\u091C\u093C \u0939\u0948`
    });
  }
  return issues;
}

// src/core/barcode.ts
var BarcodeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BarcodeError";
  }
};
var INTERNAL_PREFIX = "2";
var DIGITS_ONLY = /^\d+$/;
function computeCheckDigit(digitsWithoutCheck) {
  if (!DIGITS_ONLY.test(digitsWithoutCheck)) {
    throw new BarcodeError("\u092C\u093E\u0930\u0915\u094B\u0921 \u092E\u0947\u0902 \u0938\u093F\u0930\u094D\u092B\u093C \u0905\u0902\u0915 \u0939\u094B\u0928\u0947 \u091A\u093E\u0939\u093F\u090F");
  }
  let sum = 0;
  for (let i = digitsWithoutCheck.length - 1, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
    sum += Number(digitsWithoutCheck[i]) * weight;
  }
  return (10 - sum % 10) % 10;
}
function hasValidCheckDigit(code) {
  if (!DIGITS_ONLY.test(code) || code.length < 2) return false;
  const body = code.slice(0, -1);
  const given = Number(code[code.length - 1]);
  return computeCheckDigit(body) === given;
}
function isValidEan13(code) {
  return code.length === 13 && DIGITS_ONLY.test(code) && hasValidCheckDigit(code);
}
function isValidEan8(code) {
  return code.length === 8 && DIGITS_ONLY.test(code) && hasValidCheckDigit(code);
}
function isValidUpcA(code) {
  return code.length === 12 && DIGITS_ONLY.test(code) && hasValidCheckDigit(code);
}
function isInternalBarcode(code) {
  return isValidEan13(code) && code.startsWith(INTERNAL_PREFIX);
}
function detectBarcodeType(code) {
  const value = code.trim();
  if (isInternalBarcode(value)) return "INTERNAL";
  if (isValidEan13(value)) return "EAN13";
  if (isValidUpcA(value)) return "UPCA";
  if (isValidEan8(value)) return "EAN8";
  return "UNKNOWN";
}
function normalizeBarcode(code) {
  const value = code.trim();
  if (isValidUpcA(value)) {
    return `0${value}`;
  }
  return value;
}
function checkBarcode(input) {
  if (typeof input !== "string") {
    return { ok: false, normalized: "", type: "UNKNOWN", error: "\u092C\u093E\u0930\u0915\u094B\u0921 \u092A\u093E\u0920 (text) \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F" };
  }
  const value = input.trim();
  if (value === "") {
    return { ok: false, normalized: "", type: "UNKNOWN", error: "\u092C\u093E\u0930\u0915\u094B\u0921 \u0916\u093E\u0932\u0940 \u0939\u0948" };
  }
  if (!DIGITS_ONLY.test(value)) {
    return {
      ok: false,
      normalized: value,
      type: "UNKNOWN",
      error: "\u092C\u093E\u0930\u0915\u094B\u0921 \u092E\u0947\u0902 \u0938\u093F\u0930\u094D\u092B\u093C \u0905\u0902\u0915 \u0939\u094B\u0928\u0947 \u091A\u093E\u0939\u093F\u090F"
    };
  }
  if (value.length < 4 || value.length > 20) {
    return {
      ok: false,
      normalized: value,
      type: "UNKNOWN",
      error: "\u092C\u093E\u0930\u0915\u094B\u0921 4 \u0938\u0947 20 \u0905\u0902\u0915 \u0915\u093E \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F"
    };
  }
  const normalized = normalizeBarcode(value);
  const type = detectBarcodeType(normalized);
  if (type === "UNKNOWN") {
    const standardLength = [8, 12, 13].includes(value.length);
    return {
      ok: true,
      normalized,
      type: "UNKNOWN",
      warning: standardLength ? "\u0907\u0938 \u092C\u093E\u0930\u0915\u094B\u0921 \u0915\u093E \u0906\u0916\u093C\u093F\u0930\u0940 \u0905\u0902\u0915 (check digit) \u092E\u0947\u0932 \u0928\u0939\u0940\u0902 \u0916\u093E \u0930\u0939\u093E \u2014 \u090F\u0915 \u092C\u093E\u0930 \u0926\u094B\u092C\u093E\u0930\u093E \u0938\u094D\u0915\u0948\u0928 \u0915\u0930 \u0915\u0947 \u0926\u0947\u0916 \u0932\u0947\u0902" : "\u092F\u0947 \u0915\u093F\u0938\u0940 \u091C\u093E\u0928\u0947-\u092A\u0939\u091A\u093E\u0928\u0947 \u092C\u093E\u0930\u0915\u094B\u0921 \u0930\u0942\u092A \u0915\u093E \u0928\u0939\u0940\u0902 \u0939\u0948, \u092B\u093F\u0930 \u092D\u0940 \u0930\u0916\u093E \u091C\u093E \u0938\u0915\u0924\u093E \u0939\u0948"
    };
  }
  return { ok: true, normalized, type };
}

// src/domain/product.ts
var PRODUCT_KINDS = Object.freeze([
  {
    kind: "PACKED",
    labelHi: "\u092A\u0948\u0915\u0947\u091F \u0935\u093E\u0932\u093E",
    descHi: "\u0917\u093F\u0928\u0924\u0940 \u0938\u0947 \u092C\u093F\u0915\u0924\u093E \u0939\u0948, MRP \u091B\u092A\u093E \u0939\u0948 \u2014 \u0938\u093E\u092C\u0941\u0928, \u092C\u093F\u0938\u094D\u0915\u093F\u091F, \u0915\u094B\u0932\u094D\u0921 \u0921\u094D\u0930\u093F\u0902\u0915"
  },
  {
    kind: "LOOSE",
    labelHi: "\u0916\u0941\u0932\u093E \u0938\u093E\u092E\u093E\u0928",
    descHi: "\u0924\u094C\u0932/\u0928\u093E\u092A \u0915\u0930 \u092C\u093F\u0915\u0924\u093E \u0939\u0948 \u2014 \u091A\u093E\u0935\u0932, \u0926\u093E\u0932, \u0906\u091F\u093E, \u0916\u0941\u0932\u093E \u0924\u0947\u0932"
  },
  {
    kind: "SERVICE",
    labelHi: "\u092C\u093F\u0928\u093E \u0938\u094D\u091F\u0949\u0915",
    descHi: "\u091C\u093F\u0938\u0915\u093E \u0938\u094D\u091F\u0949\u0915 \u0928\u0939\u0940\u0902 \u0917\u093F\u0928\u093E \u091C\u093E\u0924\u093E \u2014 \u0930\u093F\u091A\u093E\u0930\u094D\u091C, \u092B\u093C\u094B\u091F\u094B\u0915\u0949\u092A\u0940, \u0925\u0948\u0932\u0940"
  }
]);
var NAME_MAX_LENGTH = 80;
var ALT_NAME_MAX_LENGTH = 80;
var MAX_PRICE_PAISE = 1e9;
function cleanText(value) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}
function err(field, message) {
  return { field, level: "error", message };
}
function warn(field, message) {
  return { field, level: "warning", message };
}
function allowedMeasures(kind) {
  switch (kind) {
    case "PACKED":
      return ["COUNT"];
    case "LOOSE":
      return ["WEIGHT", "VOLUME", "LENGTH", "COUNT"];
    case "SERVICE":
      return ["COUNT"];
    default: {
      const never = kind;
      throw new Error(`\u0905\u0928\u091C\u093E\u0928 \u0915\u093F\u0938\u094D\u092E: ${String(never)}`);
    }
  }
}
function validateProduct(draft) {
  const issues = [];
  const name = typeof draft.name === "string" ? cleanText(draft.name) : "";
  if (name === "") {
    issues.push(err("name", "\u0938\u093E\u092E\u093E\u0928 \u0915\u093E \u0928\u093E\u092E \u091C\u093C\u0930\u0942\u0930\u0940 \u0939\u0948"));
  } else if (name.length > NAME_MAX_LENGTH) {
    issues.push(err("name", `\u0928\u093E\u092E ${NAME_MAX_LENGTH} \u0905\u0915\u094D\u0937\u0930 \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u093E`));
  }
  const altNameRaw = draft.altName ?? null;
  const altName = typeof altNameRaw === "string" ? cleanText(altNameRaw) : null;
  if (altName !== null && altName.length > ALT_NAME_MAX_LENGTH) {
    issues.push(err("altName", `\u0926\u0942\u0938\u0930\u093E \u0928\u093E\u092E ${ALT_NAME_MAX_LENGTH} \u0905\u0915\u094D\u0937\u0930 \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u093E`));
  }
  const kind = draft.kind;
  if (!PRODUCT_KINDS.some((k) => k.kind === kind)) {
    issues.push(err("kind", "\u0938\u093E\u092E\u093E\u0928 \u0915\u0940 \u0915\u093F\u0938\u094D\u092E \u091A\u0941\u0928\u0928\u093E \u091C\u093C\u0930\u0942\u0930\u0940 \u0939\u0948"));
  }
  const measure = draft.measure;
  if (PRODUCT_KINDS.some((k) => k.kind === kind) && !allowedMeasures(kind).includes(measure)) {
    issues.push(
      err("measure", `"${PRODUCT_KINDS.find((k) => k.kind === kind).labelHi}" \u0938\u093E\u092E\u093E\u0928 \u0907\u0938 \u0924\u0930\u0939 \u0928\u0939\u0940\u0902 \u092C\u093F\u0915 \u0938\u0915\u0924\u093E`)
    );
  }
  if (!isUnitCode(draft.saleUnit)) {
    issues.push(err("saleUnit", "\u092C\u093F\u0915\u094D\u0930\u0940 \u0915\u0940 \u0907\u0915\u093E\u0908 \u091A\u0941\u0928\u0928\u093E \u091C\u093C\u0930\u0942\u0930\u0940 \u0939\u0948"));
  } else if (getUnit(draft.saleUnit).measure !== measure) {
    issues.push(
      err("saleUnit", `${getUnit(draft.saleUnit).labelHi} \u0907\u0938 \u0924\u0930\u0939 \u0915\u0947 \u0938\u093E\u092E\u093E\u0928 \u0915\u0940 \u0907\u0915\u093E\u0908 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u0940`)
    );
  }
  const salePrice = draft.salePrice;
  if (!Number.isSafeInteger(salePrice)) {
    issues.push(err("salePrice", "\u092C\u0947\u091A\u0928\u0947 \u0915\u093E \u0926\u093E\u092E \u0938\u0939\u0940 \u0928\u0939\u0940\u0902 \u0939\u0948"));
  } else if (salePrice <= 0) {
    issues.push(err("salePrice", "\u092C\u0947\u091A\u0928\u0947 \u0915\u093E \u0926\u093E\u092E \u0936\u0942\u0928\u094D\u092F \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F"));
  } else if (salePrice > MAX_PRICE_PAISE) {
    issues.push(err("salePrice", `\u0926\u093E\u092E ${formatPaise(toPaise(MAX_PRICE_PAISE))} \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u093E \u2014 \u090F\u0915 \u092C\u093E\u0930 \u091C\u093E\u0901\u091A \u0932\u0947\u0902`));
  }
  const mrp = draft.mrp ?? null;
  if (mrp !== null) {
    if (!Number.isSafeInteger(mrp) || mrp <= 0) {
      issues.push(err("mrp", "MRP \u0938\u0939\u0940 \u0928\u0939\u0940\u0902 \u0939\u0948"));
    } else if (mrp > MAX_PRICE_PAISE) {
      issues.push(err("mrp", "MRP \u092C\u0939\u0941\u0924 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0939\u0948 \u2014 \u090F\u0915 \u092C\u093E\u0930 \u091C\u093E\u0901\u091A \u0932\u0947\u0902"));
    } else if (Number.isSafeInteger(salePrice) && salePrice > mrp) {
      issues.push(
        err(
          "salePrice",
          `\u092C\u0947\u091A\u0928\u0947 \u0915\u093E \u0926\u093E\u092E (${formatPaise(toPaise(salePrice))}) MRP (${formatPaise(toPaise(mrp))}) \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0939\u0948 \u2014 MRP \u0938\u0947 \u090A\u092A\u0930 \u092C\u0947\u091A\u0928\u093E \u0915\u093C\u093E\u0928\u0942\u0928\u0928 \u092E\u0928\u093E \u0939\u0948`
        )
      );
    }
  }
  if (kind === "PACKED" && mrp === null) {
    issues.push(warn("mrp", "\u092A\u0948\u0915\u0947\u091F \u0935\u093E\u0932\u0947 \u0938\u093E\u092E\u093E\u0928 \u092A\u0930 MRP \u092D\u0930\u0928\u093E \u0905\u091A\u094D\u091B\u093E \u0930\u0939\u0924\u093E \u0939\u0948"));
  }
  const purchasePrice = draft.purchasePrice ?? null;
  if (purchasePrice !== null) {
    if (!Number.isSafeInteger(purchasePrice) || purchasePrice < 0) {
      issues.push(err("purchasePrice", "\u0916\u093C\u0930\u0940\u0926 \u0915\u093E \u0926\u093E\u092E \u0938\u0939\u0940 \u0928\u0939\u0940\u0902 \u0939\u0948"));
    } else if (purchasePrice > MAX_PRICE_PAISE) {
      issues.push(err("purchasePrice", "\u0916\u093C\u0930\u0940\u0926 \u0915\u093E \u0926\u093E\u092E \u092C\u0939\u0941\u0924 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0939\u0948 \u2014 \u090F\u0915 \u092C\u093E\u0930 \u091C\u093E\u0901\u091A \u0932\u0947\u0902"));
    } else if (Number.isSafeInteger(salePrice) && salePrice > 0 && salePrice < purchasePrice) {
      issues.push(
        warn(
          "salePrice",
          `\u092C\u0947\u091A\u0928\u0947 \u0915\u093E \u0926\u093E\u092E \u0916\u093C\u0930\u0940\u0926 (${formatPaise(toPaise(purchasePrice))}) \u0938\u0947 \u0915\u092E \u0939\u0948 \u2014 \u0907\u0938\u092E\u0947\u0902 \u0918\u093E\u091F\u093E \u0939\u094B\u0917\u093E`
        )
      );
    }
  }
  const gstRateBps = draft.gstRateBps;
  if (!Number.isInteger(gstRateBps) || !isKnownGstRate(gstRateBps)) {
    issues.push(err("gstRateBps", "GST \u0915\u0940 \u0926\u0930 \u091A\u0941\u0928\u0928\u093E \u091C\u093C\u0930\u0942\u0930\u0940 \u0939\u0948"));
  }
  const hsnRaw = draft.hsnCode ?? null;
  const hsnCode = typeof hsnRaw === "string" ? hsnRaw.trim() : null;
  if (hsnCode !== null && hsnCode !== "" && !isValidHsn(hsnCode)) {
    issues.push(err("hsnCode", "HSN \u0915\u094B\u0921 4, 6 \u092F\u093E 8 \u0905\u0902\u0915 \u0915\u093E \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F"));
  }
  if (typeof draft.priceIncludesGst !== "boolean") {
    issues.push(err("priceIncludesGst", "\u092C\u0924\u093E\u0928\u093E \u0939\u094B\u0917\u093E \u0915\u093F \u0926\u093E\u092E \u092E\u0947\u0902 GST \u0936\u093E\u092E\u093F\u0932 \u0939\u0948 \u092F\u093E \u0928\u0939\u0940\u0902"));
  }
  const rawBarcodes = draft.barcodes ?? [];
  const barcodes = [];
  if (!Array.isArray(rawBarcodes)) {
    issues.push(err("barcodes", "\u092C\u093E\u0930\u0915\u094B\u0921 \u0915\u0940 \u0938\u0942\u091A\u0940 \u0938\u0939\u0940 \u0928\u0939\u0940\u0902 \u0939\u0948"));
  } else {
    const seen = /* @__PURE__ */ new Set();
    for (const raw of rawBarcodes) {
      const check = checkBarcode(String(raw));
      if (!check.ok) {
        issues.push(err("barcodes", `\u092C\u093E\u0930\u0915\u094B\u0921 "${String(raw).trim()}": ${check.error}`));
        continue;
      }
      if (seen.has(check.normalized)) {
        issues.push(err("barcodes", `\u092C\u093E\u0930\u0915\u094B\u0921 "${check.normalized}" \u0926\u094B \u092C\u093E\u0930 \u0932\u093F\u0916\u093E \u0917\u092F\u093E \u0939\u0948`));
        continue;
      }
      seen.add(check.normalized);
      barcodes.push(check.normalized);
      if (check.warning) {
        issues.push(warn("barcodes", `\u092C\u093E\u0930\u0915\u094B\u0921 "${check.normalized}": ${check.warning}`));
      }
    }
  }
  const categoryId = typeof draft.categoryId === "string" ? draft.categoryId.trim() : "";
  if (categoryId === "") {
    issues.push(err("categoryId", "\u0938\u093E\u092E\u093E\u0928 \u0915\u0940 \u0936\u094D\u0930\u0947\u0923\u0940 \u091A\u0941\u0928\u0928\u093E \u091C\u093C\u0930\u0942\u0930\u0940 \u0939\u0948"));
  }
  if (typeof draft.trackStock !== "boolean") {
    issues.push(err("trackStock", "\u092C\u0924\u093E\u0928\u093E \u0939\u094B\u0917\u093E \u0915\u093F \u0938\u094D\u091F\u0949\u0915 \u0917\u093F\u0928\u0928\u093E \u0939\u0948 \u092F\u093E \u0928\u0939\u0940\u0902"));
  }
  if (kind === "SERVICE" && draft.trackStock === true) {
    issues.push(err("trackStock", "\u092C\u093F\u0928\u093E \u0938\u094D\u091F\u0949\u0915 \u0935\u093E\u0932\u0947 \u0938\u093E\u092E\u093E\u0928 \u0915\u093E \u0938\u094D\u091F\u0949\u0915 \u0928\u0939\u0940\u0902 \u0917\u093F\u0928\u093E \u091C\u093E \u0938\u0915\u0924\u093E"));
  }
  const lowStockAt = draft.lowStockAt ?? null;
  if (lowStockAt !== null) {
    if (!Number.isSafeInteger(lowStockAt) || lowStockAt <= 0) {
      issues.push(err("lowStockAt", "\u091A\u0947\u0924\u093E\u0935\u0928\u0940 \u0935\u093E\u0932\u0940 \u092E\u093E\u0924\u094D\u0930\u093E \u0936\u0942\u0928\u094D\u092F \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0939\u094B\u0928\u0940 \u091A\u093E\u0939\u093F\u090F"));
    } else if (draft.trackStock === false) {
      issues.push(warn("lowStockAt", "\u0938\u094D\u091F\u0949\u0915 \u0917\u093F\u0928\u093E \u0939\u0940 \u0928\u0939\u0940\u0902 \u091C\u093E \u0930\u0939\u093E, \u0924\u094B \u091A\u0947\u0924\u093E\u0935\u0928\u0940 \u0915\u093E \u0915\u094B\u0908 \u0905\u0938\u0930 \u0928\u0939\u0940\u0902 \u0939\u094B\u0917\u093E"));
    }
  }
  const minSaleQty = draft.minSaleQty ?? null;
  if (minSaleQty !== null && (!Number.isSafeInteger(minSaleQty) || minSaleQty <= 0)) {
    issues.push(err("minSaleQty", "\u0915\u092E \u0938\u0947 \u0915\u092E \u092E\u093E\u0924\u094D\u0930\u093E \u0936\u0942\u0928\u094D\u092F \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0939\u094B\u0928\u0940 \u091A\u093E\u0939\u093F\u090F"));
  }
  const qtyStep = draft.qtyStep ?? null;
  if (qtyStep !== null) {
    if (!Number.isSafeInteger(qtyStep) || qtyStep <= 0) {
      issues.push(err("qtyStep", "\u092E\u093E\u0924\u094D\u0930\u093E \u0915\u093E \u0917\u0941\u0923\u0915 \u0936\u0942\u0928\u094D\u092F \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F"));
    } else if (minSaleQty !== null && Number.isSafeInteger(minSaleQty) && minSaleQty > 0 && minSaleQty % qtyStep !== 0) {
      issues.push(
        err(
          "minSaleQty",
          `\u0915\u092E \u0938\u0947 \u0915\u092E \u092E\u093E\u0924\u094D\u0930\u093E (${formatQuantitySmart(minSaleQty, measure)}) \u0917\u0941\u0923\u0915 (${formatQuantitySmart(qtyStep, measure)}) \u092E\u0947\u0902 \u092A\u0942\u0930\u0940 \u0928\u0939\u0940\u0902 \u092C\u0948\u0920\u0924\u0940`
        )
      );
    }
  }
  const hasErrors = issues.some((i) => i.level === "error");
  const cleaned = hasErrors ? null : {
    name,
    altName: altName === "" ? null : altName,
    kind,
    measure,
    saleUnit: draft.saleUnit,
    salePrice,
    mrp,
    purchasePrice,
    priceIncludesGst: draft.priceIncludesGst,
    gstRateBps: toGstRate(gstRateBps),
    hsnCode: hsnCode === "" ? null : hsnCode,
    barcodes,
    categoryId,
    inSuper: draft.inSuper === true,
    trackStock: draft.trackStock,
    lowStockAt,
    minSaleQty,
    qtyStep,
    isActive: draft.isActive ?? true
  };
  return { issues, hasErrors, cleaned };
}
function searchKeyOf(product) {
  return [product.name, product.altName ?? ""].join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

// src/data/productRepo.ts
function rowToProduct(row, barcodes) {
  return {
    id: row.id,
    name: row.name,
    altName: row.alt_name,
    kind: row.kind,
    measure: row.measure,
    saleUnit: row.sale_unit,
    salePrice: toPaise(row.sale_price),
    mrp: row.mrp === null ? null : toPaise(row.mrp),
    purchasePrice: row.purchase_price === null ? null : toPaise(row.purchase_price),
    priceIncludesGst: row.price_includes_gst === 1,
    gstRateBps: toGstRate(row.gst_rate_bps),
    hsnCode: row.hsn_code,
    barcodes,
    categoryId: row.category_id,
    inSuper: row.in_super === 1,
    trackStock: row.track_stock === 1,
    lowStockAt: row.low_stock_at === null ? null : toTicks(row.low_stock_at),
    minSaleQty: row.min_sale_qty === null ? null : toTicks(row.min_sale_qty),
    qtyStep: row.qty_step === null ? null : toTicks(row.qty_step),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
var ProductRepo = class {
  constructor(db2) {
    this.db = db2;
  }
  // ---------------------------------------------------------------- पढ़ना ----
  barcodesOf(productId) {
    const rows = this.db.prepare("SELECT barcode FROM product_barcode WHERE product_id = ? ORDER BY created_at, barcode").all(productId);
    return rows.map((r) => r.barcode);
  }
  get(id) {
    const row = this.db.prepare("SELECT * FROM product WHERE id = ?").get(id);
    return row ? rowToProduct(row, this.barcodesOf(row.id)) : null;
  }
  /** बारकोड से सामान ढूँढ़ना — बिलिंग में यही सबसे ज़्यादा चलेगा, इसलिए सीधा index से. */
  findByBarcode(barcode) {
    const row = this.db.prepare(
      `SELECT p.* FROM product p
         JOIN product_barcode b ON b.product_id = p.id
         WHERE b.barcode = ?`
    ).get(barcode);
    return row ? rowToProduct(row, this.barcodesOf(row.id)) : null;
  }
  /** नाम से खोज. खाली खोज पर सब कुछ (क्रम से) लौटाता है. */
  search(query, options = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
    const activeClause = options.includeInactive ? "" : "AND is_active = 1";
    const trimmed = query.trim().toLowerCase();
    const rows = trimmed === "" ? this.db.prepare(`SELECT * FROM product WHERE 1 = 1 ${activeClause} ORDER BY name LIMIT ?`).all(limit) : this.db.prepare(
      `SELECT * FROM product
               WHERE search_key LIKE ? ESCAPE '\\' ${activeClause}
               ORDER BY
                 CASE WHEN search_key LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
                 name
               LIMIT ?`
    ).all(`%${escapeLike(trimmed)}%`, `${escapeLike(trimmed)}%`, limit);
    return rows.map((row) => rowToProduct(row, this.barcodesOf(row.id)));
  }
  /** किसी एक श्रेणी का सारा सामान. */
  byCategory(categoryId, includeInactive = false) {
    const activeClause = includeInactive ? "" : "AND is_active = 1";
    const rows = this.db.prepare(`SELECT * FROM product WHERE category_id = ? ${activeClause} ORDER BY name`).all(categoryId);
    return rows.map((row) => rowToProduct(row, this.barcodesOf(row.id)));
  }
  /** "सबसे ज़्यादा बिकने वाला" खिड़की का सामान — ये अपनी श्रेणी में भी रहता है. */
  inSuper(includeInactive = false) {
    const activeClause = includeInactive ? "" : "AND is_active = 1";
    const rows = this.db.prepare(`SELECT * FROM product WHERE in_super = 1 ${activeClause} ORDER BY name`).all();
    return rows.map((row) => rowToProduct(row, this.barcodesOf(row.id)));
  }
  count(includeInactive = false) {
    const sql = includeInactive ? "SELECT COUNT(*) AS n FROM product" : "SELECT COUNT(*) AS n FROM product WHERE is_active = 1";
    return this.db.prepare(sql).get().n;
  }
  /** इस बारकोड पर पहले से कोई सामान है क्या — सहेजने से पहले की जाँच. */
  barcodeOwner(barcode, exceptProductId) {
    const row = this.db.prepare(
      `SELECT p.* FROM product p
         JOIN product_barcode b ON b.product_id = p.id
         WHERE b.barcode = ? AND (? IS NULL OR p.id != ?)`
    ).get(barcode, exceptProductId, exceptProductId);
    return row ? rowToProduct(row, []) : null;
  }
  sameNameExists(name, exceptProductId) {
    const row = this.db.prepare(
      `SELECT 1 AS hit FROM product
         WHERE lower(trim(name)) = lower(trim(?)) AND is_active = 1
           AND (? IS NULL OR id != ?)
         LIMIT 1`
    ).get(name, exceptProductId, exceptProductId);
    return row !== void 0;
  }
  // ---------------------------------------------------------------- लिखना ----
  /** नया सामान जोड़ता है. */
  create(draft, options = {}) {
    return this.save(null, draft, options);
  }
  /** मौजूदा सामान बदलता है. */
  update(id, draft, options = {}) {
    if (this.get(id) === null) {
      return { ok: false, issues: [{ field: "form", level: "error", message: "\u092F\u0947 \u0938\u093E\u092E\u093E\u0928 \u092E\u093F\u0932\u093E \u0939\u0940 \u0928\u0939\u0940\u0902" }] };
    }
    return this.save(id, draft, options);
  }
  save(existingId, draft, options) {
    const validation = validateProduct(draft);
    if (validation.hasErrors || validation.cleaned === null) {
      return { ok: false, issues: validation.issues };
    }
    const clean = validation.cleaned;
    const issues = [...validation.issues];
    const blocking = checkProductConflicts(
      clean,
      {
        barcodeOwnerName: (barcode) => this.barcodeOwner(barcode, existingId)?.name ?? null,
        hasSameActiveName: (name) => this.sameNameExists(name, existingId)
      },
      { allowDuplicateName: options.allowDuplicateName === true }
    );
    if (blocking.length > 0) {
      return { ok: false, issues: [...issues, ...blocking] };
    }
    const at = nowIso();
    const id = existingId ?? newId();
    const before = existingId ? this.get(existingId) : null;
    const write = this.db.transaction(() => {
      const values = {
        id,
        name: clean.name,
        alt_name: clean.altName ?? null,
        search_key: searchKeyOf({ name: clean.name, altName: clean.altName ?? null }),
        kind: clean.kind,
        measure: clean.measure,
        sale_unit: clean.saleUnit,
        sale_price: clean.salePrice,
        mrp: clean.mrp ?? null,
        purchase_price: clean.purchasePrice ?? null,
        price_includes_gst: clean.priceIncludesGst ? 1 : 0,
        gst_rate_bps: clean.gstRateBps,
        hsn_code: clean.hsnCode ?? null,
        category_id: clean.categoryId,
        in_super: clean.inSuper === true ? 1 : 0,
        track_stock: clean.trackStock ? 1 : 0,
        low_stock_at: clean.lowStockAt ?? null,
        min_sale_qty: clean.minSaleQty ?? null,
        qty_step: clean.qtyStep ?? null,
        is_active: clean.isActive === false ? 0 : 1,
        created_at: before?.createdAt ?? at,
        updated_at: at
      };
      if (existingId === null) {
        this.db.prepare(
          `INSERT INTO product (
               id, name, alt_name, search_key, kind, measure, sale_unit,
               sale_price, mrp, purchase_price, price_includes_gst, gst_rate_bps, hsn_code,
               category_id, in_super, track_stock, low_stock_at, min_sale_qty, qty_step,
               is_active, created_at, updated_at
             ) VALUES (
               @id, @name, @alt_name, @search_key, @kind, @measure, @sale_unit,
               @sale_price, @mrp, @purchase_price, @price_includes_gst, @gst_rate_bps, @hsn_code,
               @category_id, @in_super, @track_stock, @low_stock_at, @min_sale_qty, @qty_step,
               @is_active, @created_at, @updated_at
             )`
        ).run(values);
      } else {
        const { created_at: _unchanged, ...updateValues } = values;
        this.db.prepare(
          `UPDATE product SET
               name = @name, alt_name = @alt_name, search_key = @search_key,
               kind = @kind, measure = @measure, sale_unit = @sale_unit,
               sale_price = @sale_price, mrp = @mrp, purchase_price = @purchase_price,
               price_includes_gst = @price_includes_gst, gst_rate_bps = @gst_rate_bps,
               hsn_code = @hsn_code, category_id = @category_id, in_super = @in_super,
               track_stock = @track_stock, low_stock_at = @low_stock_at,
               min_sale_qty = @min_sale_qty, qty_step = @qty_step,
               is_active = @is_active, updated_at = @updated_at
             WHERE id = @id`
        ).run(updateValues);
      }
      this.db.prepare("DELETE FROM product_barcode WHERE product_id = ?").run(id);
      const insertBarcode = this.db.prepare(
        "INSERT INTO product_barcode (barcode, product_id, created_at) VALUES (?, ?, ?)"
      );
      for (const barcode of clean.barcodes ?? []) {
        insertBarcode.run(barcode, id, at);
      }
      const after = this.get(id);
      this.db.prepare(
        `INSERT INTO audit_log (at, entity, entity_id, action, before_json, after_json, actor)
           VALUES (?, 'product', ?, ?, ?, ?, ?)`
      ).run(
        at,
        id,
        existingId === null ? "CREATE" : "UPDATE",
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
        options.actor ?? null
      );
      return after;
    });
    const product = write();
    return { ok: true, product, warnings: issues.filter((i) => i.level === "warning") };
  }
  /** सामान हटाना = बंद करना. मिटाया कभी नहीं जाता, वरना पुराने बिल टूट जाएँगे. */
  setActive(id, isActive, actor = null) {
    const before = this.get(id);
    if (before === null) return null;
    if (before.isActive === isActive) return before;
    const at = nowIso();
    const run = this.db.transaction(() => {
      this.db.prepare("UPDATE product SET is_active = ?, updated_at = ? WHERE id = ?").run(isActive ? 1 : 0, at, id);
      const after = this.get(id);
      this.db.prepare(
        `INSERT INTO audit_log (at, entity, entity_id, action, before_json, after_json, actor)
           VALUES (?, 'product', ?, ?, ?, ?, ?)`
      ).run(
        at,
        id,
        isActive ? "REACTIVATE" : "DEACTIVATE",
        JSON.stringify(before),
        JSON.stringify(after),
        actor
      );
      return after;
    });
    return run();
  }
  /** किसी सामान का पूरा इतिहास — कब क्या बदला. */
  history(productId) {
    const rows = this.db.prepare("SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY id").all("product", productId);
    return rows.map((r) => ({
      id: r.id,
      at: r.at,
      action: r.action,
      before: r.before_json ? JSON.parse(r.before_json) : null,
      after: r.after_json ? JSON.parse(r.after_json) : null,
      actor: r.actor
    }));
  }
};
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// src/domain/category.ts
var SUPER_CATEGORY_NAME = "\u0938\u092C\u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u092C\u093F\u0915\u0928\u0947 \u0935\u093E\u0932\u093E";
var CATEGORY_NAME_MAX_LENGTH = 40;
function cleanText2(value) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}
function validateCategory(draft) {
  const issues = [];
  const name = typeof draft.name === "string" ? cleanText2(draft.name) : "";
  if (name === "") {
    issues.push({ field: "name", level: "error", message: "\u0936\u094D\u0930\u0947\u0923\u0940 \u0915\u093E \u0928\u093E\u092E \u091C\u093C\u0930\u0942\u0930\u0940 \u0939\u0948" });
  } else if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    issues.push({
      field: "name",
      level: "error",
      message: `\u0928\u093E\u092E ${CATEGORY_NAME_MAX_LENGTH} \u0905\u0915\u094D\u0937\u0930 \u0938\u0947 \u091C\u093C\u094D\u092F\u093E\u0926\u093E \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u0924\u093E`
    });
  }
  if (name !== "" && name.toLowerCase() === SUPER_CATEGORY_NAME.toLowerCase()) {
    issues.push({
      field: "name",
      level: "error",
      message: "\u092F\u0947 \u0928\u093E\u092E \u0938\u0941\u092A\u0930 \u0916\u093F\u0921\u093C\u0915\u0940 \u0915\u093E \u0939\u0948 \u2014 \u0915\u094B\u0908 \u0926\u0942\u0938\u0930\u093E \u0928\u093E\u092E \u0930\u0916\u0947\u0902"
    });
  }
  const sortOrder = draft.sortOrder ?? 0;
  if (!Number.isSafeInteger(sortOrder)) {
    issues.push({ field: "sortOrder", level: "error", message: "\u0915\u094D\u0930\u092E\u093E\u0902\u0915 \u092A\u0942\u0930\u093E \u0905\u0902\u0915 \u0939\u094B\u0928\u093E \u091A\u093E\u0939\u093F\u090F" });
  }
  const hasErrors = issues.some((i) => i.level === "error");
  return {
    issues,
    hasErrors,
    cleaned: hasErrors ? null : { name, sortOrder, isActive: draft.isActive ?? true }
  };
}
function categoryNameKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// src/data/categoryRepo.ts
function rowToCategory(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
var CategoryRepo = class {
  constructor(db2) {
    this.db = db2;
  }
  get(id) {
    const row = this.db.prepare("SELECT * FROM category WHERE id = ?").get(id);
    return row ? rowToCategory(row) : null;
  }
  list(includeInactive = false) {
    const where = includeInactive ? "" : "WHERE is_active = 1";
    const rows = this.db.prepare(`SELECT * FROM category ${where} ORDER BY sort_order, name`).all();
    return rows.map(rowToCategory);
  }
  sameNameExists(name, exceptId) {
    const rows = this.db.prepare("SELECT name FROM category WHERE is_active = 1 AND (? IS NULL OR id != ?)").all(exceptId, exceptId);
    return rows.some((r) => categoryNameKey(r.name) === categoryNameKey(name));
  }
  create(draft) {
    return this.save(null, draft);
  }
  update(id, draft) {
    if (this.get(id) === null) {
      return { ok: false, issues: [{ field: "form", level: "error", message: "\u092F\u0947 \u0936\u094D\u0930\u0947\u0923\u0940 \u092E\u093F\u0932\u0940 \u0939\u0940 \u0928\u0939\u0940\u0902" }] };
    }
    return this.save(id, draft);
  }
  save(existingId, draft) {
    const validation = validateCategory(draft);
    if (validation.hasErrors || validation.cleaned === null) {
      return { ok: false, issues: validation.issues };
    }
    const clean = validation.cleaned;
    if (this.sameNameExists(clean.name, existingId)) {
      return {
        ok: false,
        issues: [
          ...validation.issues,
          { field: "name", level: "error", message: `"${clean.name}" \u0928\u093E\u092E \u0915\u0940 \u0936\u094D\u0930\u0947\u0923\u0940 \u092A\u0939\u0932\u0947 \u0938\u0947 \u0939\u0948` }
        ]
      };
    }
    const at = nowIso();
    const id = existingId ?? newId();
    const before = existingId ? this.get(existingId) : null;
    const write = this.db.transaction(() => {
      if (existingId === null) {
        this.db.prepare(
          `INSERT INTO category (id, name, sort_order, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).run(id, clean.name, clean.sortOrder ?? 0, clean.isActive === false ? 0 : 1, at, at);
      } else {
        this.db.prepare(
          `UPDATE category SET name = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE id = ?`
        ).run(clean.name, clean.sortOrder ?? 0, clean.isActive === false ? 0 : 1, at, id);
      }
      const after = this.get(id);
      this.db.prepare(
        `INSERT INTO audit_log (at, entity, entity_id, action, before_json, after_json, actor)
           VALUES (?, 'category', ?, ?, ?, ?, NULL)`
      ).run(
        at,
        id,
        existingId === null ? "CREATE" : "UPDATE",
        before ? JSON.stringify(before) : null,
        JSON.stringify(after)
      );
      return after;
    });
    return { ok: true, category: write() };
  }
  /**
   * श्रेणी बंद करना. जिसमें सामान हो उसे बंद नहीं किया जा सकता —
   * वरना वो सामान कहीं दिखेगा ही नहीं और चुपचाप खो जाएगा.
   */
  setActive(id, isActive) {
    const before = this.get(id);
    if (before === null) {
      return { ok: false, issues: [{ field: "form", level: "error", message: "\u092F\u0947 \u0936\u094D\u0930\u0947\u0923\u0940 \u092E\u093F\u0932\u0940 \u0939\u0940 \u0928\u0939\u0940\u0902" }] };
    }
    if (before.isActive === isActive) return { ok: true, category: before };
    if (!isActive) {
      const count = this.db.prepare("SELECT COUNT(*) AS n FROM product WHERE category_id = ? AND is_active = 1").get(id);
      if (count.n > 0) {
        return {
          ok: false,
          issues: [
            {
              field: "form",
              level: "error",
              message: `\u0907\u0938 \u0936\u094D\u0930\u0947\u0923\u0940 \u092E\u0947\u0902 ${count.n} \u0938\u093E\u092E\u093E\u0928 \u0939\u0948\u0902 \u2014 \u092A\u0939\u0932\u0947 \u0909\u0928\u094D\u0939\u0947\u0902 \u0915\u093F\u0938\u0940 \u0914\u0930 \u0936\u094D\u0930\u0947\u0923\u0940 \u092E\u0947\u0902 \u0932\u0947 \u091C\u093E\u090F\u0901`
            }
          ]
        };
      }
    }
    const at = nowIso();
    const run = this.db.transaction(() => {
      this.db.prepare("UPDATE category SET is_active = ?, updated_at = ? WHERE id = ?").run(isActive ? 1 : 0, at, id);
      const after = this.get(id);
      this.db.prepare(
        `INSERT INTO audit_log (at, entity, entity_id, action, before_json, after_json, actor)
           VALUES (?, 'category', ?, ?, ?, ?, NULL)`
      ).run(at, id, isActive ? "REACTIVATE" : "DEACTIVATE", JSON.stringify(before), JSON.stringify(after));
      return after;
    });
    return { ok: true, category: run() };
  }
  /** हर श्रेणी में कितने चालू सामान हैं — स्क्रीन पर गिनती दिखाने के लिए. */
  productCounts() {
    const rows = this.db.prepare("SELECT category_id, COUNT(*) AS n FROM product WHERE is_active = 1 GROUP BY category_id").all();
    const out = {};
    for (const row of rows) out[row.category_id] = row.n;
    return out;
  }
};

// src/core/translitOnline.ts
var ENDPOINT = globalThis.process?.env?.POS_TRANSLIT_ENDPOINT ?? "https://inputtools.google.com/request";
var ONLINE_TIMEOUT_MS = 900;
var cache = /* @__PURE__ */ new Map();
var MAX_CACHE = 2e3;
var failures = 0;
var mutedUntil = 0;
var MUTE_AFTER_FAILURES = 3;
var MUTE_MS = 6e4;
function isOnlineMuted(now = Date.now()) {
  return now < mutedUntil;
}
function parseGoogleResponse(body) {
  if (!Array.isArray(body) || body[0] !== "SUCCESS") return [];
  const groups = body[1];
  if (!Array.isArray(groups) || groups.length === 0) return [];
  const first = groups[0];
  if (!Array.isArray(first) || first.length < 2) return [];
  const candidates = first[1];
  if (!Array.isArray(candidates)) return [];
  return candidates.filter((c) => typeof c === "string" && c.trim() !== "").map((c) => c.trim());
}
function buildRequestUrl(roman, max = 5) {
  const params = new URLSearchParams({
    text: roman,
    itc: "hi-t-i0-und",
    num: String(max),
    cp: "0",
    cs: "1",
    ie: "utf-8",
    oe: "utf-8"
  });
  return `${ENDPOINT}?${params.toString()}`;
}
async function fetchOnlineSuggestions(roman, options = {}) {
  const key = roman.toLowerCase().trim();
  if (key === "" || !/^[a-zA-Z]+$/.test(key)) return [];
  const hit = cache.get(key);
  if (hit) return hit;
  if (isOnlineMuted()) return [];
  const doFetch = options.fetcher ?? globalThis.fetch;
  if (!doFetch) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? ONLINE_TIMEOUT_MS);
  try {
    const response = await doFetch(buildRequestUrl(key, options.max ?? 5), {
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseGoogleResponse(await response.json());
    failures = 0;
    if (parsed.length > 0) {
      if (cache.size >= MAX_CACHE) cache.clear();
      cache.set(key, parsed);
    }
    return parsed;
  } catch {
    failures += 1;
    if (failures >= MUTE_AFTER_FAILURES) {
      mutedUntil = Date.now() + MUTE_MS;
      failures = 0;
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}
async function probeOnline(options = {}) {
  const doFetch = options.fetcher ?? globalThis.fetch;
  if (!doFetch) {
    return { ok: false, detail: "\u0907\u0938 \u091C\u0917\u0939 \u0907\u0902\u091F\u0930\u0928\u0947\u091F \u0938\u0947 \u092C\u093E\u0924 \u0915\u0930\u0928\u0947 \u0915\u093E \u0930\u093E\u0938\u094D\u0924\u093E \u0939\u0940 \u0928\u0939\u0940\u0902 \u0939\u0948" };
  }
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? 6e3;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await doFetch(buildRequestUrl("chaawal", 5), { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, detail: `Google \u0928\u0947 ${response.status} \u0932\u094C\u091F\u093E\u092F\u093E` };
    }
    const words = parseGoogleResponse(await response.json());
    if (words.length === 0) {
      return { ok: false, detail: "Google \u0924\u0915 \u092A\u0939\u0941\u0901\u091A \u0924\u094B \u0917\u090F, \u092A\u0930 \u0915\u094B\u0908 \u0938\u0941\u091D\u093E\u0935 \u0928\u0939\u0940\u0902 \u0906\u092F\u093E" };
    }
    return { ok: true, detail: "Google \u0938\u0947 \u091C\u0935\u093E\u092C \u0906 \u0917\u092F\u093E", sample: words };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/abort/i.test(message)) {
      return { ok: false, detail: `${timeout / 1e3} \u0938\u0947\u0915\u0902\u0921 \u092E\u0947\u0902 \u091C\u0935\u093E\u092C \u0928\u0939\u0940\u0902 \u0906\u092F\u093E \u2014 \u0907\u0902\u091F\u0930\u0928\u0947\u091F \u0927\u0940\u092E\u093E \u0939\u0948 \u092F\u093E \u092C\u0902\u0926` };
    }
    return { ok: false, detail: `\u0907\u0902\u091F\u0930\u0928\u0947\u091F \u0924\u0915 \u0928\u0939\u0940\u0902 \u092A\u0939\u0941\u0901\u091A \u092A\u093E\u090F: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

// electron/main.ts
var APP_VERSION = true ? "0.2.0" : "0.0.0";
var BRAIN_VERSION = true ? "0.2.0" : APP_VERSION;
var BRAIN_DIR = process.env.POS_BRAIN_DIR ?? __dirname;
var UPDATE_BASE = process.env.POS_UPDATE_BASE ?? "https://raw.githubusercontent.com/deepeshjha98/POS_Application_release/main";
function versionLessThan(a, b) {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const left = pa[i] ?? 0;
    const right = pb[i] ?? 0;
    if (left !== right) return left < right;
  }
  return false;
}
var db;
var products;
var categories;
var mainWindow = null;
function webRoot() {
  const packaged = (0, import_node_path.join)(process.resourcesPath, "web", "index.html");
  const candidates = [(0, import_node_path.join)(import_electron.app.getPath("userData"), "web", "index.html")];
  if (import_electron.app.isPackaged) candidates.push(packaged);
  for (const folder of [process.env.POS_SHIPPED_BRAIN_DIR, BRAIN_DIR, __dirname]) {
    if (!folder) continue;
    candidates.push((0, import_node_path.join)(folder, "web", "index.html"));
    candidates.push((0, import_node_path.join)(folder, "..", "web", "index.html"));
  }
  for (const candidate of candidates) {
    if ((0, import_node_fs.existsSync)(candidate)) return candidate;
  }
  return packaged;
}
function localWebVersion() {
  const downloaded = (0, import_node_path.join)(import_electron.app.getPath("userData"), "web", "version.txt");
  if ((0, import_node_fs.existsSync)(downloaded)) return (0, import_node_fs.readFileSync)(downloaded, "utf8").trim();
  const shipped = (0, import_node_path.join)((0, import_node_path.dirname)(webRoot()), "version.txt");
  if ((0, import_node_fs.existsSync)(shipped)) return (0, import_node_fs.readFileSync)(shipped, "utf8").trim();
  return APP_VERSION;
}
function markBrainVerified() {
  const shipped = process.env.POS_SHIPPED_BRAIN_DIR;
  if (!shipped || BRAIN_DIR === shipped) return;
  try {
    const file = (0, import_node_path.join)(import_electron.app.getPath("userData"), "brain", "state.json");
    if (!(0, import_node_fs.existsSync)(file)) return;
    const state = JSON.parse((0, import_node_fs.readFileSync)(file, "utf8"));
    if (state.verified === true) return;
    (0, import_node_fs.writeFileSync)(
      file,
      JSON.stringify({ version: state.version, verified: true, tries: 0 }),
      "utf8"
    );
  } catch {
  }
}
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f1f5f9",
    title: "\u0926\u0941\u0915\u093E\u0928 \u2014 \u0938\u093E\u092E\u093E\u0928",
    webPreferences: {
      // preload उसी दिमाग़ के साथ का होना चाहिए जो अभी चल रहा है
      preload: (0, import_node_path.join)(BRAIN_DIR, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // छूने वाली स्क्रीन पर चुन-चुन कर घसीटना (text selection) परेशान करता है
      spellcheck: false
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    markBrainVerified();
  });
  void mainWindow.loadFile(webRoot());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void import_electron.shell.openExternal(url);
    return { action: "deny" };
  });
}
var METHODS = {
  health: () => ({
    ok: true,
    productCount: products.count(),
    categoryCount: categories.list().length,
    db: (0, import_node_path.join)(import_electron.app.getPath("userData"), "pos.db"),
    appVersion: APP_VERSION,
    webVersion: localWebVersion(),
    brainVersion: BRAIN_VERSION
  }),
  list: ([query, options]) => {
    const q = String(query ?? "");
    const opt = options ?? {};
    if (q.trim() === "" && opt.inSuper) {
      return { products: products.inSuper(opt.includeInactive === true) };
    }
    if (q.trim() === "" && opt.categoryId) {
      return { products: products.byCategory(opt.categoryId, opt.includeInactive === true) };
    }
    let found = products.search(q, {
      limit: opt.limit ?? 200,
      includeInactive: opt.includeInactive === true
    });
    if (opt.categoryId) found = found.filter((p) => p.categoryId === opt.categoryId);
    if (opt.inSuper) found = found.filter((p) => p.inSuper);
    return { products: found };
  },
  get: ([id]) => {
    const product = products.get(String(id));
    if (!product) throw new Error("\u0938\u093E\u092E\u093E\u0928 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E");
    return { product };
  },
  byBarcode: ([code]) => {
    const product = products.findByBarcode(String(code));
    if (!product) throw new Error("\u0907\u0938 \u092C\u093E\u0930\u0915\u094B\u0921 \u0915\u093E \u0915\u094B\u0908 \u0938\u093E\u092E\u093E\u0928 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E");
    return { product };
  },
  create: ([draft, allowDuplicateName]) => products.create(draft, { allowDuplicateName: allowDuplicateName === true }),
  update: ([id, draft, allowDuplicateName]) => products.update(String(id), draft, {
    allowDuplicateName: allowDuplicateName === true
  }),
  setActive: ([id, isActive]) => {
    const product = products.setActive(String(id), isActive === true);
    if (!product) throw new Error("\u0938\u093E\u092E\u093E\u0928 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E");
    return { product };
  },
  categories: ([includeInactive]) => ({
    categories: categories.list(includeInactive === true),
    counts: categories.productCounts(),
    superCount: products.inSuper().length
  }),
  // Google से transliteration. ये app के दिमाग़ में होता है, पर्दे में नहीं —
  // वहाँ browser की CORS वाली रुकावट लगती है, यहाँ नहीं.
  translitOnline: ([roman]) => fetchOnlineSuggestions(String(roman ?? "")),
  /** दुकानदार ख़ुद जाँच सके कि Google वाला हिस्सा चल रहा है या नहीं. */
  translitCheck: () => probeOnline(),
  createCategory: ([draft]) => categories.create(draft),
  updateCategory: ([id, draft]) => categories.update(String(id), draft),
  setCategoryActive: ([id, isActive]) => categories.setActive(String(id), isActive === true)
};
async function fetchUpdateInfo() {
  const response = await fetch(`${UPDATE_BASE}/version.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`\u0928\u092F\u093E \u0930\u0942\u092A \u0926\u0947\u0916\u0928\u0947 \u092E\u0947\u0902 \u0926\u093F\u0915\u093C\u094D\u0915\u093C\u0924 (${response.status})`);
  return await response.json();
}
async function checkUpdate() {
  const info = await fetchUpdateInfo();
  const web = {
    current: localWebVersion(),
    latest: info.web,
    hasUpdate: info.web !== localWebVersion()
  };
  const brainLatest = info.brain ?? BRAIN_VERSION;
  const brain = {
    current: BRAIN_VERSION,
    latest: brainLatest,
    hasUpdate: brainLatest !== BRAIN_VERSION
  };
  return {
    web,
    brain,
    needsFullApp: versionLessThan(APP_VERSION, info.minApp ?? "0.0.0"),
    needsRestart: brain.hasUpdate,
    notes: info.notes,
    downloadUrl: info.downloadUrl,
    current: web.current,
    latest: web.latest,
    hasUpdate: web.hasUpdate || brain.hasUpdate
  };
}
async function downloadVerified(path) {
  const [fileResponse, sumResponse] = await Promise.all([
    fetch(`${UPDATE_BASE}/${path}`, { cache: "no-store" }),
    fetch(`${UPDATE_BASE}/${path}.sha256`, { cache: "no-store" })
  ]);
  if (!fileResponse.ok) throw new Error(`${path} \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u0940 (${fileResponse.status})`);
  const data = Buffer.from(await fileResponse.arrayBuffer());
  if (sumResponse.ok) {
    const expected = (await sumResponse.text()).trim().split(/\s+/)[0];
    const actual = (0, import_node_crypto.createHash)("sha256").update(data).digest("hex");
    if (expected && expected !== actual) {
      throw new Error(`${path} \u092A\u0942\u0930\u0940 \u0928\u0939\u0940\u0902 \u0909\u0924\u0930\u0940 \u2014 \u0905\u092A\u0921\u0947\u091F \u0930\u094B\u0915 \u0926\u093F\u092F\u093E \u0917\u092F\u093E`);
    }
  }
  return data;
}
async function applyUpdate() {
  const info = await fetchUpdateInfo();
  const userData = import_electron.app.getPath("userData");
  let webApplied = false;
  let brainApplied = false;
  if (info.web !== localWebVersion()) {
    const page = await downloadVerified("web/index.html");
    const folder = (0, import_node_path.join)(userData, "web");
    (0, import_node_fs.mkdirSync)(folder, { recursive: true });
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(folder, "index.html"), page);
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(folder, "version.txt"), info.web, "utf8");
    webApplied = true;
  }
  const brainLatest = info.brain ?? BRAIN_VERSION;
  if (brainLatest !== BRAIN_VERSION) {
    const [mainJs, preloadJs] = await Promise.all([
      downloadVerified("brain/main.cjs"),
      downloadVerified("brain/preload.cjs")
    ]);
    const folder = (0, import_node_path.join)(userData, "brain", brainLatest);
    (0, import_node_fs.mkdirSync)(folder, { recursive: true });
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(folder, "main.cjs"), mainJs);
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(folder, "preload.cjs"), preloadJs);
    (0, import_node_fs.writeFileSync)((0, import_node_path.join)(folder, "version.txt"), brainLatest, "utf8");
    (0, import_node_fs.writeFileSync)(
      (0, import_node_path.join)(userData, "brain", "state.json"),
      JSON.stringify({ version: brainLatest, verified: false, tries: 0 }),
      "utf8"
    );
    brainApplied = true;
  }
  return {
    webApplied,
    brainApplied,
    needsRestart: brainApplied,
    webVersion: info.web,
    brainVersion: brainLatest,
    applied: webApplied || brainApplied,
    version: info.web
  };
}
async function applyFullUpdate() {
  const [zip, cmd] = await Promise.all([
    downloadVerified("install/dukan-app.zip"),
    downloadVerified("install/DukanPOS-Setup.cmd")
  ]);
  const folder = (0, import_node_path.join)(import_electron.app.getPath("userData"), "installer");
  (0, import_node_fs.mkdirSync)(folder, { recursive: true });
  (0, import_node_fs.writeFileSync)((0, import_node_path.join)(folder, "dukan-app.zip"), zip);
  const setup = (0, import_node_path.join)(folder, "DukanPOS-Setup.cmd");
  (0, import_node_fs.writeFileSync)(setup, cmd);
  if (process.platform !== "win32") {
    return {
      downloaded: true,
      started: false,
      folder,
      reason: "\u092F\u0947 \u0938\u093F\u0930\u094D\u092B\u093C Windows \u092A\u0930 \u0916\u093C\u0941\u0926 \u0932\u0917 \u0938\u0915\u0924\u093E \u0939\u0948"
    };
  }
  const child = (0, import_node_child_process.spawn)("cmd.exe", ["/c", setup, "/auto"], {
    cwd: folder,
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();
  return { downloaded: true, started: true, folder };
}
if (process.env.POS_USER_DATA) {
  import_electron.app.setPath("userData", process.env.POS_USER_DATA);
}
import_electron.app.whenReady().then(() => {
  const dataFolder = import_electron.app.getPath("userData");
  const dbFile = (0, import_node_path.join)(dataFolder, "pos.db");
  try {
    (0, import_node_fs.mkdirSync)(dataFolder, { recursive: true });
    db = openDatabase(dbFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pos] \u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u0928\u0939\u0940\u0902 \u0916\u0941\u0932\u093E:", dbFile, message);
    import_electron.dialog.showErrorBox("\u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u0928\u0939\u0940\u0902 \u0916\u0941\u0932\u093E", `${dbFile}

${message}`);
    import_electron.app.quit();
    return;
  }
  products = new ProductRepo(db);
  categories = new CategoryRepo(db);
  import_electron.ipcMain.handle("pos:call", (_event, method, args) => {
    const handler = METHODS[method];
    if (!handler) throw new Error(`\u0905\u0928\u091C\u093E\u0928 \u0915\u093E\u092E: ${method}`);
    return handler(args ?? []);
  });
  import_electron.ipcMain.handle("pos:update-check", () => checkUpdate());
  import_electron.ipcMain.handle("pos:update-apply", () => applyUpdate());
  import_electron.ipcMain.handle("pos:update-full", async () => {
    const result = await applyFullUpdate();
    if (result.started) {
      setTimeout(() => import_electron.app.exit(0), 1200);
    }
    return result;
  });
  import_electron.ipcMain.handle("pos:relaunch", (_event, hard) => {
    if (hard === true) {
      import_electron.app.relaunch();
      import_electron.app.exit(0);
      return;
    }
    if (mainWindow) void mainWindow.loadFile(webRoot());
  });
  import_electron.ipcMain.handle("pos:open-data-folder", () => import_electron.shell.openPath(import_electron.app.getPath("userData")));
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  try {
    db?.close();
  } catch {
  }
  import_electron.app.quit();
});
