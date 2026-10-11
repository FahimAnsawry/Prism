import { type ErRelation, type ErSchema, isMany } from "./er.js";
import type { TableColumn, TableData } from "./elements.js";

// get_schema_code: an ER diagram's tables and relations as a Prisma schema, Postgres DDL or a
// Drizzle (pg-core) schema. Column types are free text on the board, so each format maps the
// common Prisma and SQL spellings and passes anything else (an enum, a custom type) through.

export const SCHEMA_FORMATS = ["prisma", "sql", "drizzle"] as const;
export type SchemaFormat = (typeof SCHEMA_FORMATS)[number];

type Scalar =
  "String" | "Int" | "BigInt" | "Float" | "Decimal" | "Boolean" | "DateTime" | "Json" | "Bytes";

const SCALARS: Scalar[] = [
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Json",
  "Bytes",
];

/** SQL spellings (lowercase, without a size) and the Prisma scalar each stands for. */
const SQL_SCALARS: Record<string, Scalar> = {
  uuid: "String",
  text: "String",
  string: "String",
  varchar: "String",
  "character varying": "String",
  char: "String",
  character: "String",
  citext: "String",
  int: "Int",
  integer: "Int",
  int4: "Int",
  smallint: "Int",
  int2: "Int",
  serial: "Int",
  bigint: "BigInt",
  int8: "BigInt",
  bigserial: "BigInt",
  float: "Float",
  float4: "Float",
  float8: "Float",
  real: "Float",
  double: "Float",
  "double precision": "Float",
  numeric: "Decimal",
  decimal: "Decimal",
  money: "Decimal",
  bool: "Boolean",
  boolean: "Boolean",
  timestamp: "DateTime",
  timestamptz: "DateTime",
  "timestamp with time zone": "DateTime",
  "timestamp without time zone": "DateTime",
  date: "DateTime",
  datetime: "DateTime",
  time: "DateTime",
  json: "Json",
  jsonb: "Json",
  bytea: "Bytes",
  blob: "Bytes",
  binary: "Bytes",
};

interface ColumnType {
  /** The type as written, without `?`, `[]` or a size: "varchar", "String", "Role". */
  base: string;
  /** A size or precision in parentheses: "255", "10, 2". */
  size: string | null;
  list: boolean;
  /** The Prisma scalar it maps to; null for an enum or anything unknown. */
  scalar: Scalar | null;
  /** Written the SQL way ("uuid", "varchar(255)") rather than as a Prisma scalar. */
  sql: boolean;
}

function parseType(type: string): ColumnType {
  let rest = type.trim().replace(/\?$/, "");
  const list = rest.endsWith("[]");
  if (list) rest = rest.slice(0, -2);
  const sized = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(rest);
  const base = (sized?.[1] ?? rest).trim();
  const size = sized?.[2]?.trim() || null;
  const prisma = SCALARS.find((s) => s === base);
  if (prisma) return { base, size, list, scalar: prisma, sql: false };
  const sql = SQL_SCALARS[base.toLowerCase()] ?? null;
  return { base, size, list, scalar: sql, sql: sql !== null };
}

const isNullable = (column: TableColumn) => !!column.nullable || column.type.trim().endsWith("?");

/** A valid identifier for `name` (spaces and symbols become underscores). */
const ident = (name: string) => {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned || "_";
};
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (s: string) =>
  /[^aeiou]y$/i.test(s) ? `${s.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/i.test(s) ? `${s}es` : `${s}s`;
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
/** A table's description as comment lines starting with `prefix`. */
const docLines = (description: string | undefined, prefix: string) =>
  (description?.trim() ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${prefix} ${line}`);

/** Relations that name both a column on each end (the only ones a schema can express). */
const keyed = (schema: ErSchema) =>
  schema.relations.filter(
    (r): r is ErRelation & { from: { column: string }; to: { column: string } } =>
      !!r.from.column && !!r.to.column,
  );

const unkeyed = (schema: ErSchema) =>
  schema.relations.filter((r) => !r.from.column || !r.to.column);

/** The schema as code in `format`. */
export function schemaCode(schema: ErSchema, format: SchemaFormat) {
  if (format === "prisma") return prismaSchema(schema);
  if (format === "sql") return sqlSchema(schema);
  return drizzleSchema(schema);
}

// ── Prisma ────────────────────────────────────────────────────────────────

function prismaType(column: TableColumn) {
  const type = parseType(column.type);
  const attrs: string[] = [];
  let name = type.scalar ?? ident(type.base);
  if (type.sql && type.scalar === "String") {
    const lower = type.base.toLowerCase();
    if (lower === "uuid") attrs.push("@db.Uuid");
    else if (lower === "varchar" || lower === "character varying") {
      attrs.push(type.size ? `@db.VarChar(${type.size})` : "@db.VarChar");
    } else if (lower === "char" || lower === "character") {
      attrs.push(type.size ? `@db.Char(${type.size})` : "@db.Char");
    }
  } else if (type.sql && type.scalar === "Decimal" && type.size) {
    attrs.push(`@db.Decimal(${type.size})`);
  } else if (type.sql && type.scalar === "DateTime") {
    const lower = type.base.toLowerCase();
    if (lower === "date") attrs.push("@db.Date");
    else if (lower === "timestamptz" || lower === "timestamp with time zone") {
      attrs.push("@db.Timestamptz");
    }
  } else if (type.sql && type.scalar === "Json" && type.base.toLowerCase() === "json") {
    attrs.push("@db.Json");
  }
  if (type.list) name += "[]";
  else if (isNullable(column)) name += "?";
  return { name, attrs };
}

function prismaSchema(schema: ErSchema) {
  const models = new Map<string, string[][]>();
  const modelName = new Map(schema.tables.map((t) => [t.name, ident(t.name)]));
  const fieldNames = new Map<string, Set<string>>();
  const extra = new Map<string, string[]>();
  const attrsOf = (table: TableData, column: TableColumn) => {
    const singlePk = table.columns.filter((c) => c.pk).length === 1;
    return [
      ...(column.pk && singlePk ? ["@id"] : []),
      ...(column.unique && !column.pk ? ["@unique"] : []),
    ];
  };

  for (const table of schema.tables) {
    const rows: string[][] = [];
    const names = new Set<string>();
    for (const column of table.columns) {
      const field = ident(column.name);
      names.add(field);
      const type = prismaType(column);
      rows.push([
        field,
        type.name,
        [
          ...attrsOf(table, column),
          ...type.attrs,
          ...(field !== column.name ? [`@map(${JSON.stringify(column.name)})`] : []),
        ].join(" "),
      ]);
    }
    models.set(table.name, rows);
    fieldNames.set(table.name, names);
    const blockAttrs: string[] = [];
    const pks = table.columns.filter((c) => c.pk);
    if (pks.length > 1) blockAttrs.push(`@@id([${pks.map((c) => ident(c.name)).join(", ")}])`);
    if (pks.length === 0) blockAttrs.push("// No primary key on the board: add @id or @@id.");
    if (modelName.get(table.name) !== table.name) {
      blockAttrs.push(`@@map(${JSON.stringify(table.name)})`);
    }
    extra.set(table.name, blockAttrs);
  }

  const unique = (table: string, wanted: string) => {
    const names = fieldNames.get(table) ?? new Set<string>();
    let name = wanted;
    for (let i = 2; names.has(name); i++) name = `${wanted}${i}`;
    names.add(name);
    return name;
  };
  const pairCount = new Map<string, number>();
  const pairKey = (a: string, b: string) => [a, b].sort().join("\u0000");
  for (const r of keyed(schema)) {
    const key = pairKey(r.from.table, r.to.table);
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }

  for (const r of keyed(schema)) {
    const from = schema.tables.find((t) => t.name === r.from.table);
    const toModel = modelName.get(r.to.table);
    const fromModel = modelName.get(r.from.table);
    if (!from || !toModel || !fromModel) continue;
    const column = from.columns.find((c) => c.name === r.from.column);
    const base = r.from.column.replace(/_?(id|Id|ID)$/, "");
    const forward = unique(
      r.from.table,
      base && base !== r.from.column ? ident(base) : lowerFirst(toModel),
    );
    const oneToOne = !isMany(r.fromHead) && r.fromHead !== null;
    const back = unique(
      r.to.table,
      oneToOne ? lowerFirst(fromModel) : plural(lowerFirst(fromModel)),
    );
    const named =
      r.from.table === r.to.table || (pairCount.get(pairKey(r.from.table, r.to.table)) ?? 0) > 1;
    const relationName = named ? `${JSON.stringify(`${fromModel}${upperFirst(forward)}`)}, ` : "";
    const optional = (column && isNullable(column)) || r.toHead === "zero-or-one";
    models
      .get(r.from.table)
      ?.push([
        forward,
        `${toModel}${optional ? "?" : ""}`,
        `@relation(${relationName}fields: [${ident(r.from.column)}], references: [${ident(r.to.column)}])`,
      ]);
    models
      .get(r.to.table)
      ?.push([
        back,
        oneToOne ? `${fromModel}?` : `${fromModel}[]`,
        named ? `@relation(${relationName.slice(0, -2)})` : "",
      ]);
    // A one-to-one's foreign key must be unique.
    if (oneToOne && column && !column.unique && !column.pk) {
      const row = models.get(r.from.table)?.find((cells) => cells[0] === ident(column.name));
      if (row) row[2] = [row[2], "@unique"].filter(Boolean).join(" ");
    }
  }

  const blocks = schema.tables.map((table) => {
    const rows = models.get(table.name) ?? [];
    const w0 = Math.max(0, ...rows.map((r) => r[0]?.length ?? 0));
    const w1 = Math.max(0, ...rows.map((r) => r[1]?.length ?? 0));
    const lines = rows.map(([name = "", type = "", attrs = ""]) =>
      `  ${name.padEnd(w0)} ${attrs ? type.padEnd(w1) : type} ${attrs}`.trimEnd(),
    );
    const block = extra.get(table.name) ?? [];
    return [
      ...docLines(table.description, "///"),
      `model ${modelName.get(table.name)} {`,
      ...lines,
      ...(block.length > 0 ? ["", ...block.map((line) => `  ${line}`)] : []),
      "}",
    ].join("\n");
  });
  const notes = unkeyed(schema).map(
    (r) => `// ${r.from.table} → ${r.to.table}: draw both ends at a column to make it a relation.`,
  );
  return [...blocks, ...(notes.length > 0 ? [notes.join("\n")] : [])].join("\n\n") + "\n";
}

// ── SQL (Postgres) ────────────────────────────────────────────────────────

const PG_TYPES: Record<Scalar, string> = {
  String: "text",
  Int: "integer",
  BigInt: "bigint",
  Float: "double precision",
  Decimal: "numeric(65,30)",
  Boolean: "boolean",
  DateTime: "timestamp(3)",
  Json: "jsonb",
  Bytes: "bytea",
};

function sqlType(column: TableColumn) {
  const type = parseType(column.type);
  let out: string;
  if (type.sql) out = `${type.base.toLowerCase()}${type.size ? `(${type.size})` : ""}`;
  else if (type.scalar) out = PG_TYPES[type.scalar];
  else out = quote(type.base);
  return type.list ? `${out}[]` : out;
}

function sqlSchema(schema: ErSchema) {
  const creates = schema.tables.map((table) => {
    const lines = table.columns.map(
      (column) =>
        `  ${quote(column.name)} ${sqlType(column)}${isNullable(column) ? "" : " NOT NULL"}`,
    );
    const pks = table.columns.filter((c) => c.pk);
    if (pks.length > 0) {
      lines.push(
        `  CONSTRAINT ${quote(`${table.name}_pkey`)} PRIMARY KEY (${pks.map((c) => quote(c.name)).join(", ")})`,
      );
    }
    for (const column of table.columns.filter((c) => c.unique && !c.pk)) {
      lines.push(
        `  CONSTRAINT ${quote(`${table.name}_${column.name}_key`)} UNIQUE (${quote(column.name)})`,
      );
    }
    return [
      ...docLines(table.description, "--"),
      `CREATE TABLE ${quote(table.name)} (\n${lines.join(",\n")}\n);`,
    ].join("\n");
  });
  const keys = keyed(schema).map(
    (r) =>
      `ALTER TABLE ${quote(r.from.table)} ADD CONSTRAINT ${quote(`${r.from.table}_${r.from.column}_fkey`)} FOREIGN KEY (${quote(r.from.column)}) REFERENCES ${quote(r.to.table)} (${quote(r.to.column)});`,
  );
  const notes = unkeyed(schema).map(
    (r) =>
      `-- ${r.from.table} → ${r.to.table}: draw both ends at a column to make it a foreign key.`,
  );
  return (
    [creates.join("\n\n"), keys.join("\n"), notes.join("\n")].filter(Boolean).join("\n\n") + "\n"
  );
}

// ── Drizzle (pg-core) ─────────────────────────────────────────────────────

function drizzleColumn(column: TableColumn, imports: Set<string>) {
  const type = parseType(column.type);
  const name = JSON.stringify(column.name);
  const lower = type.base.toLowerCase();
  let call: string;
  let note = "";
  const use = (builder: string, args = name) => {
    imports.add(builder);
    return `${builder}(${args})`;
  };
  switch (type.scalar) {
    case "String":
      if (lower === "uuid") call = use("uuid");
      else if (lower === "varchar" || lower === "character varying") {
        call = use("varchar", type.size ? `${name}, { length: ${type.size} }` : name);
      } else if (lower === "char" || lower === "character") {
        call = use("char", type.size ? `${name}, { length: ${type.size} }` : name);
      } else call = use("text");
      break;
    case "Int":
      call =
        lower === "serial"
          ? use("serial")
          : lower === "smallint"
            ? use("smallint")
            : use("integer");
      break;
    case "BigInt":
      call = use("bigint", `${name}, { mode: "bigint" }`);
      break;
    case "Float":
      call = lower === "real" || lower === "float4" ? use("real") : use("doublePrecision");
      break;
    case "Decimal":
      call = use("numeric");
      break;
    case "Boolean":
      call = use("boolean");
      break;
    case "DateTime":
      call =
        lower === "date"
          ? use("date")
          : use(
              "timestamp",
              lower === "timestamptz" || lower === "timestamp with time zone"
                ? `${name}, { withTimezone: true }`
                : `${name}, { precision: 3 }`,
            );
      break;
    case "Json":
      call = lower === "json" ? use("json") : use("jsonb");
      break;
    case "Bytes":
      call = use("text");
      note = " // bytea: define a customType";
      break;
    default:
      call = use("text");
      note = ` // ${type.base}: an enum or custom type (pgEnum / customType)`;
  }
  if (type.list) call += ".array()";
  return { call, note };
}

function drizzleSchema(schema: ErSchema) {
  const imports = new Set<string>(["pgTable"]);
  const varName = new Map<string, string>();
  const used = new Set<string>();
  for (const table of schema.tables) {
    let name = lowerFirst(ident(table.name));
    for (let i = 2; used.has(name); i++) name = `${lowerFirst(ident(table.name))}${i}`;
    used.add(name);
    varName.set(table.name, name);
  }
  const references = new Map<string, ErRelation & { to: { column: string } }>();
  for (const r of keyed(schema)) references.set(`${r.from.table}\u0000${r.from.column}`, r);

  const blocks = schema.tables.map((table) => {
    const pks = table.columns.filter((c) => c.pk);
    const lines = table.columns.map((column) => {
      const { call, note } = drizzleColumn(column, imports);
      let chain = call;
      if (column.pk && pks.length === 1) chain += ".primaryKey()";
      else if (!isNullable(column)) chain += ".notNull()";
      if (column.unique && !column.pk) chain += ".unique()";
      const ref = references.get(`${table.name}\u0000${column.name}`);
      const target = ref && varName.get(ref.to.table);
      if (ref && target) chain += `.references(() => ${target}.${ident(ref.to.column)})`;
      const key = /^[A-Za-z_$][\w$]*$/.test(column.name)
        ? column.name
        : JSON.stringify(column.name);
      return `  ${key}: ${chain},${note}`;
    });
    const composite =
      pks.length > 1
        ? `, (t) => [primaryKey({ columns: [${pks.map((c) => `t.${ident(c.name)}`).join(", ")}] })]`
        : "";
    if (composite) imports.add("primaryKey");
    const doc = table.description?.trim()
      ? `/** ${table.description
          .trim()
          .replace(/\*\//g, "* /")
          .replace(/\s*\n\s*/g, " ")} */\n`
      : "";
    return `${doc}export const ${varName.get(table.name)} = pgTable(${JSON.stringify(table.name)}, {\n${lines.join("\n")}\n}${composite});`;
  });
  const notes = unkeyed(schema).map(
    (r) => `// ${r.from.table} → ${r.to.table}: draw both ends at a column to make it a reference.`,
  );
  const head = `import { ${[...imports].sort().join(", ")} } from "drizzle-orm/pg-core";`;
  return [head, ...blocks, ...(notes.length > 0 ? [notes.join("\n")] : [])].join("\n\n") + "\n";
}
